import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../shared-component/service/environments/environment';
import { formatApiDate, parseApiDate } from '../../../service/sales/date.util';

export interface DeliveryLineItem {
  name: string;
  quantity: number;
  unit: string;
  delivered: number;
  pending: number;
}

export interface DeliveryItem {
  id: string;
  lpoNumber: string;
  vendorName: string;
  vendorId: string;
  requestTitle: string;
  itemCount: number;
  orderedDate: string;
  expectedDelivery: string;
  deliveredDate: string | null;
  status: 'PENDING' | 'IN_TRANSIT' | 'PARTIALLY_DELIVERED' | 'DELIVERED' | 'OVERDUE';
  items: DeliveryLineItem[];
}

type FilterStatus = 'ALL' | 'PENDING' | 'IN_TRANSIT' | 'PARTIALLY_DELIVERED' | 'DELIVERED' | 'OVERDUE';

@Component({
  selector: 'app-delivery-management',
  templateUrl: './delivery-management.component.html',
  styleUrl: './delivery-management.component.scss'
})
export class DeliveryManagementComponent implements OnInit {

  private get tenantId(): string {
    const h = window.location.hostname;
    return (h.includes('localhost') || h.includes('127.0.0.1')) ? 'optimax' : h.split('.')[0] || 'optimax';
  }

  private get baseUrl(): string {
    return environment.apiBaseUrl + '/x/api/v2/commerce';
  }

  deliveries: DeliveryItem[] = [];
  filteredDeliveries: DeliveryItem[] = [];
  filterStatus: FilterStatus = 'ALL';
  searchTerm = '';
  selectedDelivery: DeliveryItem | null = null;
  isLoading = false;
  isUpdating = false;

  showConfirmModal = false;
  confirmModalType: 'full' | 'partial' = 'full';
  pendingDeliveryId = '';

  stats = { total: 0, pending: 0, inTransit: 0, partiallyDelivered: 0, delivered: 0, overdue: 0 };

  ngOnInit(): void {
    this.loadDeliveries();
  }

  constructor(private http: HttpClient) {}

  loadDeliveries(): void {
    this.isLoading = true;
    this.http.get<any>(
      `${this.baseUrl}/lpos?tenantId=${this.tenantId}&page=1&size=50`
    ).subscribe({
      next: (response: any) => {
        const raw: any[] = response?.data || response?.content || response?.items || [];
        this.deliveries = raw.map((lpo: any) => this.mapLpoToDelivery(lpo));
        this.applyFilter();
        this.calculateStats();
        this.isLoading = false;
      },
      error: () => {
        this.deliveries = [];
        this.filteredDeliveries = [];
        this.calculateStats();
        this.isLoading = false;
      }
    });
  }

  private mapLpoToDelivery(lpo: any): DeliveryItem {
    const items: DeliveryLineItem[] = (lpo.items || lpo.lineItems || []).map((item: any) => ({
      name: item.name || item.description || item.itemName || 'Unknown Item',
      quantity: item.quantity || item.orderedQuantity || 0,
      unit: item.unit || item.uom || 'pcs',
      delivered: item.deliveredQuantity || item.delivered || 0,
      pending: (item.quantity || 0) - (item.deliveredQuantity || item.delivered || 0)
    }));

    const rawStatus = (lpo.deliveryStatus || lpo.status || 'PENDING').toUpperCase();
    const statusMap: Record<string, DeliveryItem['status']> = {
      PENDING: 'PENDING',
      IN_TRANSIT: 'IN_TRANSIT',
      INTRANSIT: 'IN_TRANSIT',
      PARTIALLY_DELIVERED: 'PARTIALLY_DELIVERED',
      PARTIAL: 'PARTIALLY_DELIVERED',
      DELIVERED: 'DELIVERED',
      OVERDUE: 'OVERDUE'
    };

    return {
      id: lpo.id || lpo.lpoId || '',
      lpoNumber: lpo.lpoNumber || lpo.referenceNumber || lpo.number || 'N/A',
      vendorName: lpo.vendorName || lpo.vendor?.name || 'Unknown Vendor',
      vendorId: lpo.vendorId || lpo.vendor?.id || '',
      requestTitle: lpo.requestTitle || lpo.title || lpo.description || 'N/A',
      itemCount: items.length || lpo.itemCount || 0,
      orderedDate: lpo.orderedDate || lpo.createdAt || lpo.issueDate || '',
      expectedDelivery: lpo.expectedDelivery || lpo.deliveryDate || lpo.expectedDeliveryDate || '',
      deliveredDate: lpo.deliveredDate || lpo.actualDeliveryDate || null,
      status: statusMap[rawStatus] || 'PENDING',
      items
    };
  }

  applyFilter(): void {
    let list = this.deliveries;

    if (this.filterStatus !== 'ALL') {
      list = list.filter(d => d.status === this.filterStatus);
    }

    if (this.searchTerm.trim()) {
      const term = this.searchTerm.toLowerCase();
      list = list.filter(d =>
        d.lpoNumber.toLowerCase().includes(term) ||
        d.vendorName.toLowerCase().includes(term) ||
        d.requestTitle.toLowerCase().includes(term)
      );
    }

    this.filteredDeliveries = list;
  }

  setFilter(status: FilterStatus): void {
    this.filterStatus = status;
    this.applyFilter();
  }

  onSearchChange(): void {
    this.applyFilter();
  }

  private calculateStats(): void {
    this.stats = {
      total: this.deliveries.length,
      pending: this.deliveries.filter(d => d.status === 'PENDING').length,
      inTransit: this.deliveries.filter(d => d.status === 'IN_TRANSIT').length,
      partiallyDelivered: this.deliveries.filter(d => d.status === 'PARTIALLY_DELIVERED').length,
      delivered: this.deliveries.filter(d => d.status === 'DELIVERED').length,
      overdue: this.deliveries.filter(d => d.status === 'OVERDUE' || this.isOverdue(d.expectedDelivery, d.status)).length
    };
  }

  updateDeliveryStatus(id: string, status: DeliveryItem['status']): void {
    this.isUpdating = true;
    this.http.patch(`${this.baseUrl}/lpos/${id}/status`, { status }).subscribe({
      next: () => {
        const idx = this.deliveries.findIndex(d => d.id === id);
        if (idx !== -1) {
          this.deliveries[idx] = { ...this.deliveries[idx], status };
          if (this.selectedDelivery?.id === id) {
            this.selectedDelivery = { ...this.deliveries[idx] };
          }
        }
        this.applyFilter();
        this.calculateStats();
        this.isUpdating = false;
      },
      error: () => {
        this.isUpdating = false;
      }
    });
  }

  confirmDelivery(id: string): void {
    this.isUpdating = true;
    this.http.patch(`${this.baseUrl}/lpos/${id}/status`, {
      status: 'DELIVERED',
      deliveredAt: new Date()
    }).subscribe({
      next: () => {
        const now = new Date().toISOString();
        const idx = this.deliveries.findIndex(d => d.id === id);
        if (idx !== -1) {
          this.deliveries[idx] = { ...this.deliveries[idx], status: 'DELIVERED', deliveredDate: now };
          if (this.selectedDelivery?.id === id) {
            this.selectedDelivery = { ...this.deliveries[idx] };
          }
        }
        this.applyFilter();
        this.calculateStats();
        this.isUpdating = false;
        this.showConfirmModal = false;
      },
      error: () => {
        this.isUpdating = false;
        this.showConfirmModal = false;
      }
    });
  }

  openDetail(delivery: DeliveryItem): void {
    this.selectedDelivery = delivery;
  }

  closeDetail(): void {
    this.selectedDelivery = null;
  }

  openConfirmModal(id: string, type: 'full' | 'partial'): void {
    this.pendingDeliveryId = id;
    this.confirmModalType = type;
    this.showConfirmModal = true;
  }

  confirmAction(): void {
    if (!this.pendingDeliveryId) return;
    if (this.confirmModalType === 'full') {
      this.confirmDelivery(this.pendingDeliveryId);
    } else {
      this.updateDeliveryStatus(this.pendingDeliveryId, 'PARTIALLY_DELIVERED');
      this.showConfirmModal = false;
    }
  }

  getStatusColor(status: string): string {
    const map: Record<string, string> = {
      PENDING: 'badge-pending',
      IN_TRANSIT: 'badge-in-transit',
      PARTIALLY_DELIVERED: 'badge-partial',
      DELIVERED: 'badge-delivered',
      OVERDUE: 'badge-overdue'
    };
    return map[status] || 'badge-pending';
  }

  getStatusLabel(status: string): string {
    const map: Record<string, string> = {
      PENDING: 'Pending',
      IN_TRANSIT: 'In Transit',
      PARTIALLY_DELIVERED: 'Partial',
      DELIVERED: 'Delivered',
      OVERDUE: 'Overdue'
    };
    return map[status] || status;
  }

  getDaysOverdue(expected: string): number {
    const due = parseApiDate(expected);
    if (!due) return 0;
    const diff = Date.now() - due.getTime();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  }

  isOverdue(expected: string, status: string): boolean {
    if (status === 'DELIVERED') return false;
    const due = parseApiDate(expected);
    return !!due && due < new Date();
  }

  getDeliveredCount(delivery: DeliveryItem): number {
    return delivery.items.reduce((sum, i) => sum + i.delivered, 0);
  }

  getTotalCount(delivery: DeliveryItem): number {
    return delivery.items.reduce((sum, i) => sum + i.quantity, 0);
  }

  getProgressPercent(delivery: DeliveryItem): number {
    const total = this.getTotalCount(delivery);
    if (total === 0) return 0;
    return Math.round((this.getDeliveredCount(delivery) / total) * 100);
  }

  formatDate(date: string | null): string {
    return formatApiDate(date);
  }

  trackById(_: number, item: DeliveryItem): string {
    return item.id;
  }
}

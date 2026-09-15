import { RequestForQuotationFormComponent } from './../request-for-quotation-form/request-for-quotation-form.component';
import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { Router, NavigationEnd } from '@angular/router';
import { v4 as uuidV4 } from 'uuid';
import { Subject, debounceTime, distinctUntilChanged, takeUntil, forkJoin, filter } from 'rxjs';
import { saveAs } from 'file-saver';
import { ProcurementRequestService } from '../../../service/procurement/procurement.service';
import { ProcurementRequest, RequestFilters, RequestStatus, PaginatedResponse } from '../../../domain/procurement-request/procurement.dto';
import { TableAction, TableColumn } from '../../../shared-component/view/table/table.component';
import { MessageService } from 'primeng/api';


// Extended interface to handle _rowType property
interface ExtendedProcurementRequest extends ProcurementRequest {
  _rowType?: 'ORDER' | 'SINGLE';
  _itemCount?: number;
  quantity?: number;
  deliveryLocation?: string;
  deliveryDeadline?: Date;
}

@Component({
  selector: 'app-product-request-list',
  templateUrl: './request-for-quotation-list.component.html',
  styleUrls: ['./request-for-quotation-list.component.scss']
})
export class RequestForQuotationListComponent implements OnInit, OnDestroy {
  Math = Math;

  readonly newRequestLink = '/admin/sales/commerce/requests/new';
  readonly draftsLink = '/admin/sales/commerce/requests/drafts/' + uuidV4();
  readonly multiOrderLink = '/admin/sales/commerce/orders/new/' + uuidV4();
  tableColumns: TableColumn<any>[] = [];
  tableActions: TableAction<any>[] = [];
  selectedRequests: ProcurementRequest[] = [];
  allRows: ExtendedProcurementRequest[] = [];
  isSubmittingCancel = false;

  sortField = 'createdAt';
  sortAsc = false;

  // Date range state
  dateRange: string = 'month';
  showCancelDialog = false;
  showViewDialog = false;
  showCreateOptions = false;
  selectedRequest: ProcurementRequest | null = null;
  viewRequestDetails: ProcurementRequest | null = null;
  isLoadingDetails = false;
  cancellationReason: string = '';

  // Customization state
  customization = {
    showRevenueChart: true,
    showTopProducts: true,
    showRecentRequests: true,
    chartType: 'bar' as 'bar' | 'line' | 'pie' | 'doughnut'
  };

  // Sample data for charts
  procurementData: any[] = [];
  recentRequests: ExtendedProcurementRequest[] = [];
  topProducts: any[] = [];
  cancellationAvatars: string[] = ['JD', 'AK', 'ML', 'TN'];

  formatBudget(row: any): string {
    return `${row.currency} ${Number(row.totalBudget || 0).toLocaleString()}`;
  }
  getRowQuantity(row: ExtendedProcurementRequest): number {
    if (row._rowType === 'ORDER') {
      return row.quantity || 0;
    }
    return row.items ? row.items.reduce((s: number, i: any) => s + i.quantity, 0) : 0;
  }
  setSort(field: string): void {
    if (this.sortField === field) {
      this.sortAsc = !this.sortAsc;
    } else {
      this.sortField = field;
      this.sortAsc = true;
    }
    this.sortAllRows();
  }

  getSortIcon(field: string): string {
    if (this.sortField !== field) {
      return 'fa-sort';
    }
    return this.sortAsc ? 'fa-sort-up' : 'fa-sort-down';
  }

  sortAllRows(): void {
    if (!this.sortField) return;
    this.allRows.sort((a, b) => {
      let valA: any = a[this.sortField as keyof ExtendedProcurementRequest];
      let valB: any = b[this.sortField as keyof ExtendedProcurementRequest];

      // Handle nulls/undefined
      if (valA === undefined || valA === null) valA = '';
      if (valB === undefined || valB === null) valB = '';

      if (typeof valA === 'string') {
        valA = valA.toLowerCase();
        valB = String(valB).toLowerCase();
      }

      if (valA < valB) return this.sortAsc ? -1 : 1;
      if (valA > valB) return this.sortAsc ? 1 : -1;
      return 0;
    });
  }

  get showCancelModal(): boolean {
    return this.showCancelDialog;
  }

  readonly statusClassMap: Partial<Record<RequestStatus, string>> = {
    'DRAFT': 'status-chip status-draft',
    'PENDING_APPROVAL': 'status-chip status-pending-approval',
    'REJECTED': 'status-chip status-rejected',
    'PENDING': 'status-chip status-pending',
    'VENDORS_QUOTING': 'status-chip status-quoting',
    'VENDOR_SELECTED': 'status-chip status-selected',
    'LPO_ISSUED': 'status-chip status-lpo',
    'PAYMENT_PENDING': 'status-chip status-payment-pending',
    'PAYMENT_CONFIRMED': 'status-chip status-payment-confirmed',
    'DELIVERY_IN_PROGRESS': 'status-chip status-delivery',
    'DELIVERED': 'status-chip status-delivered',
    'COMPLETED': 'status-chip status-completed',
    'CANCELLED': 'status-chip status-cancelled',
    'APPROVED': 'status-chip status-approved'
  };

  isDeadlineSoon(deadline: Date | string | undefined): boolean {
    if (!deadline) return false;
    const deadlineDate = new Date(deadline);
    const now = new Date();
    const diff = deadlineDate.getTime() - now.getTime();
    // 3 days in ms
    return diff < 3 * 24 * 60 * 60 * 1000 && diff > 0;
  }

  toggleCreateOptions(): void {
    this.showCreateOptions = !this.showCreateOptions;
  }

  openCancelModal(request: ProcurementRequest): void {
    const reason = window.prompt(`Please provide a cancellation reason for ${request.id}:`, 'No longer required');
    if (reason === null) {
      return;
    }

    const trimmedReason = reason.trim();
    if (!trimmedReason) {
      this.messageService.add({ severity: 'warn', summary: 'Warning', detail: 'Cancellation reason is required.' });
      return;
    }

    this.isLoading = true;
    this.procurementRequestService.cancelRequest(request.id, trimmedReason)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.loadRequests();
        },
        error: (error: any) => {
          console.error('Error cancelling request:', error);
          this.isLoading = false;
        }
      });
  }

  closeCancelModal(): void {
    this.showCancelDialog = false;
    this.selectedRequest = null;
    this.cancellationReason = '';
  }

  confirmCancel(): void {
    if (!this.selectedRequest) return;
    this.closeCancelModal();
    this.loadRequests();
  }

  requests: ProcurementRequest[] = [];
  isLoading = false;
  totalElements = 0;
  currentPage = 0;
  pageSize = 10;
  totalPages = 0;

  filterForm: FormGroup;
  statusOptions: { value: RequestStatus | 'ALL'; label: string }[] = [
    { value: 'ALL', label: 'All Requests' },
    { value: 'PENDING_APPROVAL', label: 'Pending Approval' },
    { value: 'APPROVED', label: 'Approved' },
    { value: 'PENDING', label: 'Pending' },
    { value: 'VENDORS_QUOTING', label: 'Vendors Quoting' },
    { value: 'VENDOR_SELECTED', label: 'Vendor Selected' },
    { value: 'LPO_ISSUED', label: 'LPO Issued' },
    { value: 'PAYMENT_PENDING', label: 'Payment Pending' },
    { value: 'PAYMENT_CONFIRMED', label: 'Payment Confirmed' },
    { value: 'DELIVERY_IN_PROGRESS', label: 'Delivery in Progress' },
    { value: 'DELIVERED', label: 'Delivered' },
    { value: 'CANCELLED', label: 'Cancelled' }
  ];

  private destroy$ = new Subject<void>();

  constructor(
    private messageService: MessageService,
    private procurementRequestService: ProcurementRequestService,
    private fb: FormBuilder,
    private router: Router
  ) {
    this.filterForm = this.fb.group({
      status: ['ALL'],
      searchTerm: [''],
      dateFrom: [''],
      dateTo: ['']
    });

    this.tableColumns = [
      { header: 'Request ID', field: 'id', sortable: true, className: 'col-id' },
      {
        header: 'Product / Order Name',
        sortable: true,
        sortField: 'title',
        formatter: (row) => this.truncate(row.title, 30),
        className: 'col-product'
      },
      { header: 'Qty', field: 'quantity', align: 'right', sortable: true, className: 'col-qty' },
      {
        header: 'Budget',
        sortable: true,
        sortField: 'totalBudget',
        formatter: (row) => `${row.currency} ${Number(row.totalBudget || 0).toLocaleString()}`,
        align: 'right',
        className: 'col-budget'
      },
      {
        header: 'Delivery',
        formatter: (row) => this.truncate(row.deliveryLocation, 24),
        className: 'col-delivery'
      },
      {
        header: 'Deadline',
        sortable: true,
        sortField: 'deliveryDeadline',
        formatter: (row) => this.formatDate(row.deliveryDeadline),
        className: 'col-deadline'
      },
      {
        header: 'Status',
        formatter: (row) => this.getStatusLabel(row.status),
        badgeClass: (row) => this.getStatusClass(row.status),
        className: 'col-status'
      },
      {
        header: 'Ratings',
        formatter: (row) => this.getRatingDisplay(row),
        className: 'col-rating',
        align: 'center'
      },
      {
        header: 'Created',
        sortable: true,
        sortField: 'createdAt',
        formatter: (row) => this.formatDate(row.createdAt),
        className: 'col-created'
      }
    ];

    this.tableActions = [
      {
        id: 'view',
        label: 'View',
        icon: 'bi bi-eye',
        className: 'action-view'
      },
      {
        id: 'edit',
        label: 'Edit',
        icon: 'bi bi-pencil',
        className: 'action-edit',
        visible: (row: any) => row._rowType !== 'ORDER' && this.canEdit(row)
      },
      {
        id: 'cancel',
        label: 'Cancel',
        icon: 'bi bi-x-circle',
        className: 'action-cancel',
        visible: (row: any) => row._rowType !== 'ORDER' && this.canCancel(row)
      }
    ];
  }

  ngOnInit(): void {
    this.loadRequests();
    this.setupFilterSubscriptions();
    this.loadDashboardData();

    // Reload list whenever the user navigates back to this view
    this.router.events
      .pipe(
        filter((e): e is NavigationEnd => e instanceof NavigationEnd),
        filter(e => e.urlAfterRedirects === '/admin/sales/commerce/requests'),
        takeUntil(this.destroy$)
      )
      .subscribe(() => this.loadRequests());
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private setupFilterSubscriptions(): void {
    this.filterForm.valueChanges
      .pipe(
        debounceTime(500),
        distinctUntilChanged(),
        takeUntil(this.destroy$)
      )
      .subscribe(() => {
        this.currentPage = 0;
        this.loadRequests();
      });
  }

  loadRequests(): void {
    this.isLoading = true;

    const filters: RequestFilters = {
      status: this.filterForm.get('status')?.value,
      searchTerm: this.filterForm.get('searchTerm')?.value,
      dateFrom: this.filterForm.get('dateFrom')?.value ? new Date(this.filterForm.get('dateFrom')?.value) : undefined,
      dateTo: this.filterForm.get('dateTo')?.value ? new Date(this.filterForm.get('dateTo')?.value) : undefined,
      page: this.currentPage,
      size: this.pageSize
    };

    this.procurementRequestService.getRequests(filters)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (page) => {
          this.requests = page.data;
          this.totalElements = page.totalElements;
          this.totalPages = page.totalPages;
          this.selectedRequests = this.selectedRequests.filter((selected) =>
            this.requests.some((request) => request.id === selected.id)
          );
          this.allRows = [...this.requests] as ExtendedProcurementRequest[];
          this.sortAllRows();
          this.isLoading = false;
          // Update dashboard data after loading
          this.loadDashboardData();
        },
        error: (error: any) => {
          console.error('Error loading requests:', error);
          this.isLoading = false;
        }
      });
  }


  onPageChange(page: number): void {
    this.currentPage = page;
    this.loadRequests();
  }

  onPageSizeChange(size: number): void {
    this.pageSize = size;
    this.currentPage = 0;
    this.loadRequests();
  }

  get selectedRequestIds(): number[] {
    return this.selectedRequests.map((request) => request.id);
  }

  onSelectionChange(selection: ProcurementRequest[] | ProcurementRequest): void {
    if (Array.isArray(selection)) {
      this.selectedRequests = selection;
      return;
    }

    this.selectedRequests = selection ? [selection] : [];
  }

  toggleSelectAll(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.selectedRequests = target.checked ? [...this.requests] : [];
  }

  isAllSelected(): boolean {
    return this.requests.length > 0 && this.selectedRequests.length === this.requests.length;
  }

  isSomeSelected(): boolean {
    return this.selectedRequests.length > 0 && this.selectedRequests.length < this.requests.length;
  }

  toggleSelection(requestId: number, event: Event): void {
    const target = event.target as HTMLInputElement;

    if (target.checked) {
      const request = this.requests.find((item) => item.id === requestId);
      if (request && !this.isSelected(requestId)) {
        this.selectedRequests = [...this.selectedRequests, request];
      }
      return;
    }

    this.selectedRequests = this.selectedRequests.filter((request) => request.id !== requestId);
  }

  isSelected(requestId: number): boolean {
    return this.selectedRequests.some((request) => request.id === requestId);
  }



  getStatusClass(status: RequestStatus): string {
    return this.statusClassMap[status] || 'status-chip status-pending';
  }

  getStatusLabel(status: RequestStatus): string {
    const labels: Partial<Record<RequestStatus, string>> = {
      'DRAFT': 'Draft',
      'PENDING_APPROVAL': 'Pending Approval',
      'REJECTED': 'Rejected',
      'PENDING': 'Pending',
      'VENDORS_QUOTING': 'Vendors Quoting',
      'VENDOR_SELECTED': 'Vendor Selected',
      'LPO_ISSUED': 'LPO Issued',
      'PAYMENT_PENDING': 'Payment Pending',
      'PAYMENT_CONFIRMED': 'Payment Confirmed',
      'DELIVERY_IN_PROGRESS': 'Delivery in Progress',
      'DELIVERED': 'Delivered',
      'COMPLETED': 'Completed',
      'CANCELLED': 'Cancelled',
      'APPROVED': 'Approved'
    };

    return labels[status] || status;
  }

  getStatusBadgeClass(status: RequestStatus): string {
    const classes: Partial<Record<RequestStatus, string>> = {
      'DRAFT': 'px-2 py-1 text-xs font-medium rounded-full bg-slate-100 text-slate-800',
      'PENDING_APPROVAL': 'px-2 py-1 text-xs font-medium rounded-full bg-orange-100 text-orange-800',
      'REJECTED': 'px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800',
      'PENDING': 'px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800',
      'VENDORS_QUOTING': 'px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800',
      'VENDOR_SELECTED': 'px-2 py-1 text-xs font-medium rounded-full bg-purple-100 text-purple-800',
      'LPO_ISSUED': 'px-2 py-1 text-xs font-medium rounded-full bg-indigo-100 text-indigo-800',
      'PAYMENT_PENDING': 'px-2 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-800',
      'PAYMENT_CONFIRMED': 'px-2 py-1 text-xs font-medium rounded-full bg-teal-100 text-teal-800',
      'DELIVERY_IN_PROGRESS': 'px-2 py-1 text-xs font-medium rounded-full bg-cyan-100 text-cyan-800',
      'DELIVERED': 'px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800',
      'COMPLETED': 'px-2 py-1 text-xs font-medium rounded-full bg-emerald-100 text-emerald-800',
      'CANCELLED': 'px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800',
      'APPROVED': 'px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800'
    };
    return classes[status] || classes['PENDING'] || 'px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800';
  }

  formatCurrency(amount: number, currency: string): string {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency }).format(amount);
  }

  getRatingDisplay(request: ProcurementRequest): string {
    const rating = this.procurementRequestService.getSavedVendorRating(request.id, request.selectedVendorId);
    if (!rating) {
      return request.status === 'DELIVERED' ? 'Not rated' : 'Pending';
    }

    return `${rating.overallRating}/5 ${'★'.repeat(Math.floor(rating.overallRating))}`;
  }

  getInProgressCount(): number {
    const inProgressStatuses = ['PENDING', 'VENDORS_QUOTING', 'VENDOR_SELECTED', 'LPO_ISSUED', 'PAYMENT_PENDING', 'PAYMENT_CONFIRMED', 'DELIVERY_IN_PROGRESS'];
    return this.requests.filter(r => inProgressStatuses.includes(r.status)).length;
  }

  getDeliveredCount(): number {
    return this.requests.filter(r => r.status === 'DELIVERED').length;
  }

  getCancelledCount(): number {
    return this.requests.filter(r => r.status === 'CANCELLED').length;
  }

  canEdit(request: ProcurementRequest): boolean {
    const nonEditableStatuses: RequestStatus[] = ['DELIVERED', 'CANCELLED'];
    return !nonEditableStatuses.includes(request.status);
  }

  canCancel(request: ProcurementRequest): boolean {
    const nonCancellableStatuses: RequestStatus[] = ['DELIVERED', 'CANCELLED', 'DELIVERY_IN_PROGRESS'];
    return !nonCancellableStatuses.includes(request.status);
  }

  resetFilters(): void {
    this.filterForm.reset({
      status: 'ALL',
      searchTerm: '',
      dateFrom: '',
      dateTo: ''
    });
  }

  onActionClick(event: { actionId: string; row: any }): void {

    if (event.actionId === 'view') {
      if (event.row._rowType === 'ORDER') {
        this.router.navigate(['/admin/sales/commerce/orders', event.row.id]);
      } else {
        this.router.navigate(['/admin/sales/commerce/requests', event.row.id]);
      }
      return;
    }
    if (event.row._rowType === 'ORDER') return;
    if (event.actionId === 'edit') {
      const typePath = event.row.procurementType?.toLowerCase() === 'service' ? 'service' : 'product';
      this.router.navigate(['/admin/sales/commerce/requests/new', typePath, event.row.id]);
      return;
    }
    if (event.actionId === 'cancel') {
      this.openCancelModal(event.row);
    }
  }

  openViewModal(request: ProcurementRequest): void {
    this.router.navigate(['/admin/sales/commerce/requests', request.id]);
  }



  closeViewModal(): void {
    this.showViewDialog = false;
    this.viewRequestDetails = null;
  }

  truncate(value: string | undefined, limit: number): string {
    if (!value) return '';
    return value.length > limit ? `${value.slice(0, limit)}...` : value;
  }

  formatDate(value: string | Date | undefined): string {
    if (!value) return '-';
    return new Date(value).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  }

  getPageNumbers(): number[] {
    const maxVisible = 5;
    let start = Math.max(0, this.currentPage - Math.floor(maxVisible / 2));
    let end = Math.min(this.totalPages, start + maxVisible);

    if (end - start < maxVisible) {
      start = Math.max(0, end - maxVisible);
    }

    return Array.from({ length: end - start }, (_, i) => start + i);
  }

  // ============ DASHBOARD METHODS ============

  changeDateRange(range: string): void {
    this.dateRange = range;
    this.loadDashboardData();
  }

  loadDashboardData(): void {
    this.procurementData = this.generateProcurementData();
    this.recentRequests = this.getRecentRequests();
    this.topProducts = this.getTopProducts();
  }

  private generateProcurementData(): any[] {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return months.map((month, i) => ({
      month: month,
      value: Math.floor(Math.random() * 50) + 10
    }));
  }

  private getRecentRequests(): ExtendedProcurementRequest[] {
    // Return first 5 requests as recent, ensure they have _rowType
    return this.requests.slice(0, 5).map(req => ({
      ...req,
      _rowType: (req as any)._rowType || 'SINGLE'
    })) as ExtendedProcurementRequest[];
  }

  private getTopProducts(): any[] {
    const productMap = new Map<string, { name: string, count: number, budget: number }>();

    this.requests.forEach(req => {
      const key = req.title || 'Unknown';
      if (productMap.has(key)) {
        const existing = productMap.get(key)!;
        existing.count += 1;
        existing.budget += req.totalBudget || 0;
      } else {
        productMap.set(key, {
          name: key,
          count: 1,
          budget: req.totalBudget || 0
        });
      }
    });

    return Array.from(productMap.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }

  openNewRequest(): void {
    this.router.navigate(['/admin/sales/commerce/requests/new']);
  }

  viewAllRequests(): void {
    this.router.navigate(['/admin/sales/commerce/requests']);
  }

  viewDrafts(): void {
    this.router.navigate([this.draftsLink]);
  }



  applyFilter(status: string): void {
    this.filterForm.patchValue({ status: status });
    this.loadRequests();
  }

  viewRequest(requestId: string): void {
    this.router.navigate(['/admin/sales/commerce/requests', requestId]);
  }

  openCustomizationModal(): void {
    console.log('Open customization modal');
  }

  // ============ CHART METHODS ============

  getMaxProcurementValue(): number {
    if (!this.procurementData || this.procurementData.length === 0) return 100;
    return Math.max(...this.procurementData.map(d => d.value)) * 1.2;
  }

  getLineChartPathProcurement(): string {
    if (!this.procurementData || this.procurementData.length === 0) return '';

    const width = 480;
    const height = 180;
    const padding = 20;
    const maxValue = this.getMaxProcurementValue();

    return this.procurementData.map((d, i) => {
      const x = padding + (i / (this.procurementData.length - 1)) * (width - padding * 2);
      const y = height - padding - (d.value / maxValue) * (height - padding * 2);
      return (i === 0 ? 'M' : 'L') + x + ',' + y;
    }).join(' ');
  }

  getLineChartAreaPathProcurement(): string {
    if (!this.procurementData || this.procurementData.length === 0) return '';

    const width = 480;
    const height = 180;
    const padding = 20;
    const maxValue = this.getMaxProcurementValue();

    const points = this.procurementData.map((d, i) => {
      const x = padding + (i / (this.procurementData.length - 1)) * (width - padding * 2);
      const y = height - padding - (d.value / maxValue) * (height - padding * 2);
      return x + ',' + y;
    }).join(' ');

    return 'M' + points + ' L' + (width - padding) + ',' + (height - padding) + ' L' + padding + ',' + (height - padding) + ' Z';
  }

  getPointXProcurement(index: number): number {
    const width = 480;
    const padding = 20;
    if (!this.procurementData || this.procurementData.length === 0) return padding;
    return padding + (index / (this.procurementData.length - 1)) * (width - padding * 2);
  }

  getPointYProcurement(value: number): number {
    const height = 180;
    const padding = 20;
    const maxValue = this.getMaxProcurementValue();
    return height - padding - (value / maxValue) * (height - padding * 2);
  }

  getProcurementConicGradient(): string {
    if (!this.procurementData || this.procurementData.length === 0) return '#e2e8f0';

    const total = this.procurementData.reduce((sum, d) => sum + d.value, 0);
    if (total === 0) return '#e2e8f0';

    const colors = ['#184440', '#2a736e', '#3a9a93', '#5ab0a8', '#7ac4bc', '#9ad8d0', '#baece4', '#d4f0ec'];

    let gradient = '';
    let currentAngle = 0;

    this.procurementData.forEach((d, i) => {
      const percentage = (d.value / total) * 100;
      const color = colors[i % colors.length];
      gradient += `${color} ${currentAngle}deg ${currentAngle + percentage * 3.6}deg, `;
      currentAngle += percentage * 3.6;
    });

    return `conic-gradient(${gradient.slice(0, -2)})`;
  }

  getProcurementConicLegendColor(index: number): string {
    const colors = ['#184440', '#2a736e', '#3a9a93', '#5ab0a8', '#7ac4bc', '#9ad8d0', '#baece4', '#d4f0ec'];
    return colors[index % colors.length];
  }

  getProcurementConicPercent(value: number): string {
    const total = this.procurementData.reduce((sum, d) => sum + d.value, 0);
    if (total === 0) return '0%';
    return Math.round((value / total) * 100) + '%';
  }

  // ============ HELPER METHODS ============

  getStatusClassForBadge(status: RequestStatus): string {
    const classes: Partial<Record<RequestStatus, string>> = {
      'DRAFT': 'draft',
      'PENDING_APPROVAL': 'pending',
      'REJECTED': 'rejected',
      'PENDING': 'pending',
      'VENDORS_QUOTING': 'quoting',
      'VENDOR_SELECTED': 'selected',
      'LPO_ISSUED': 'lpo',
      'PAYMENT_PENDING': 'payment-pending',
      'PAYMENT_CONFIRMED': 'payment-confirmed',
      'DELIVERY_IN_PROGRESS': 'delivery',
      'DELIVERED': 'delivered',
      'COMPLETED': 'completed',
      'CANCELLED': 'cancelled',
      'APPROVED': 'approved'
    };
    return classes[status] || 'pending';
  }
}
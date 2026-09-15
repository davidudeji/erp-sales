import { Component, OnInit, OnDestroy, Input } from '@angular/core';
import { FormBuilder, FormGroup, FormArray, Validators } from '@angular/forms';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { MessageService } from 'primeng/api';
import { SupplyChainService } from '../../../service/procurement/supply-chain.service';
import {
  DeliveryTracking, GoodsReceivedNote,
  DeliveryStatus, GrnStatus, GrnItemCondition
} from '../../../domain/procurement-request/procurement.dto';

@Component({
  selector: 'app-delivery-tracking',
  templateUrl: './delivery-tracking.component.html',
  styleUrls: ['./delivery-tracking.component.scss']
})
export class DeliveryTrackingComponent implements OnInit, OnDestroy {
  @Input() lpoId = '';
  @Input() lpoNumber = '';
  @Input() vendorName = '';
  @Input() procurementRequestId = 0;
  @Input() lpoItems: any[] = [];  // ProcurementLpoItem[]

  private destroy$ = new Subject<void>();

  delivery: DeliveryTracking | null = null;
  grn: GoodsReceivedNote | null = null;
  activeTab: 'tracking' | 'grn' | 'history' = 'tracking';
  isLoadingDelivery = false;
  isLoadingGrn = false;
  isSubmittingGrn = false;
  showGrnForm = false;
  grnForm!: FormGroup;

  readonly deliveryStatuses: { value: DeliveryStatus; label: string; icon: string; color: string }[] = [
    { value: 'SCHEDULED',        label: 'Scheduled',        icon: 'pi pi-calendar',      color: '#6366f1' },
    { value: 'DISPATCHED',       label: 'Dispatched',       icon: 'pi pi-box',            color: '#2563eb' },
    { value: 'IN_TRANSIT',       label: 'In Transit',       icon: 'pi pi-truck',          color: '#0891b2' },
    { value: 'OUT_FOR_DELIVERY', label: 'Out for Delivery', icon: 'pi pi-send',           color: '#7c3aed' },
    { value: 'DELIVERED',        label: 'Delivered',        icon: 'pi pi-check-circle',   color: '#16a34a' },
    { value: 'PARTIALLY_DELIVERED', label: 'Partial Delivery', icon: 'pi pi-exclamation-triangle', color: '#d97706' },
    { value: 'FAILED',           label: 'Delivery Failed',  icon: 'pi pi-times-circle',   color: '#dc2626' },
  ];

  readonly conditionOptions: { value: GrnItemCondition; label: string }[] = [
    { value: 'GOOD',          label: 'Good condition' },
    { value: 'DAMAGED',       label: 'Damaged' },
    { value: 'WRONG_ITEM',    label: 'Wrong item' },
    { value: 'SHORT_SUPPLY',  label: 'Short supply' },
    { value: 'EXCESS_SUPPLY', label: 'Excess supply' },
  ];

  constructor(
    private fb: FormBuilder,
    private supplyChainService: SupplyChainService,
    private messageService: MessageService
  ) {}

  ngOnInit(): void {
    this.buildGrnForm();
    this.loadData();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadData(): void {
    if (!this.lpoId) return;
    this.isLoadingDelivery = true;
    this.isLoadingGrn = true;

    this.supplyChainService.getDeliveryByLpo(this.lpoId).pipe(takeUntil(this.destroy$)).subscribe({
      next: (d) => { this.delivery = d; this.isLoadingDelivery = false; },
      error: () => { this.isLoadingDelivery = false; }
    });

    this.supplyChainService.getGrnByLpo(this.lpoId).pipe(takeUntil(this.destroy$)).subscribe({
      next: (g) => {
        this.grn = g;
        if (g) { this.populateGrnForm(g); }
        this.isLoadingGrn = false;
      },
      error: () => { this.isLoadingGrn = false; }
    });
  }

  private buildGrnForm(): void {
    this.grnForm = this.fb.group({
      deliveryNoteNumber: [''],
      receivedBy:         ['', Validators.required],
      deliveryAddress:    ['', Validators.required],
      vehicleDetails:     [''],
      driverName:         [''],
      driverPhone:        [''],
      overallCondition:   ['ACCEPTABLE', Validators.required],
      discrepancyNotes:   [''],
      items: this.fb.array(
        (this.lpoItems || []).map(item => this.buildItemGroup(item))
      )
    });
  }

  private buildItemGroup(item: any): FormGroup {
    return this.fb.group({
      lpoItemId:        [item.id],
      name:             [item.name],
      orderedQuantity:  [item.quantity],
      receivedQuantity: [item.quantity, [Validators.required, Validators.min(0)]],
      acceptedQuantity: [item.quantity, [Validators.required, Validators.min(0)]],
      rejectedQuantity: [0, [Validators.required, Validators.min(0)]],
      unit:             [item.unit],
      unitPrice:        [item.unitPrice ?? 0],
      condition:        ['GOOD', Validators.required],
      batchNumber:      [''],
      storageLocation:  [''],
      notes:            ['']
    });
  }

  private populateGrnForm(grn: GoodsReceivedNote): void {
    this.grnForm.patchValue({
      deliveryNoteNumber: grn.deliveryNoteNumber ?? '',
      receivedBy:         grn.receivedBy,
      deliveryAddress:    grn.deliveryAddress,
      vehicleDetails:     grn.vehicleDetails ?? '',
      driverName:         grn.driverName ?? '',
      driverPhone:        grn.driverPhone ?? '',
      overallCondition:   grn.overallCondition,
      discrepancyNotes:   grn.discrepancyNotes ?? ''
    });
  }

  get itemsArray(): FormArray {
    return this.grnForm.get('items') as FormArray;
  }

  get itemGroups(): FormGroup[] {
    return this.itemsArray.controls as FormGroup[];
  }

  onReceivedQtyChange(index: number): void {
    const group = this.itemGroups[index];
    const received = group.get('receivedQuantity')?.value || 0;
    const rejected = group.get('rejectedQuantity')?.value || 0;
    group.patchValue({ acceptedQuantity: Math.max(0, received - rejected) });
  }

  onRejectedQtyChange(index: number): void {
    this.onReceivedQtyChange(index);
  }

  /** Returns 1-based step index in the main progression (SCHEDULED → DELIVERED). */
  getDeliveryStatusStep(): number {
    if (!this.delivery) return 0;
    const order: DeliveryStatus[] = ['SCHEDULED', 'DISPATCHED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED'];
    const idx = order.indexOf(this.delivery.currentStatus);
    return idx >= 0 ? idx + 1 : 0;
  }

  getStatusInfo(status: DeliveryStatus) {
    return this.deliveryStatuses.find(s => s.value === status) ?? null;
  }

  getDaysUntilDelivery(): number {
    if (!this.delivery?.estimatedDeliveryDate) return 0;
    return Math.ceil((new Date(this.delivery.estimatedDeliveryDate).getTime() - Date.now()) / 86_400_000);
  }

  get computedOrderedValue(): number {
    return this.itemGroups.reduce((sum, g) => {
      return sum + ((g.get('orderedQuantity')?.value || 0) * (g.get('unitPrice')?.value || 0));
    }, 0);
  }

  get computedReceivedValue(): number {
    return this.itemGroups.reduce((sum, g) => {
      return sum + ((g.get('receivedQuantity')?.value || 0) * (g.get('unitPrice')?.value || 0));
    }, 0);
  }

  get computedVariance(): number {
    return this.computedReceivedValue - this.computedOrderedValue;
  }

  /** Opens the GRN form for a new or draft GRN. */
  openGrnForm(): void {
    if (!this.grn) {
      // Re-initialize items in case lpoItems were loaded after ngOnInit
      const itemsArray = this.grnForm.get('items') as FormArray;
      itemsArray.clear();
      (this.lpoItems || []).forEach(item => itemsArray.push(this.buildItemGroup(item)));
    }
    this.showGrnForm = true;
    this.activeTab = 'grn';
  }

  saveGrn(): void {
    if (this.grnForm.invalid) {
      this.grnForm.markAllAsTouched();
      return;
    }
    this.isSubmittingGrn = true;

    const formVal = this.grnForm.value;
    const orderedValue = this.computedOrderedValue;
    const receivedValue = this.computedReceivedValue;

    const grnData: Partial<GoodsReceivedNote> = {
      lpoId:                Number(this.lpoId) || 0,
      lpoNumber:            this.lpoNumber,
      procurementRequestId: this.procurementRequestId,
      vendorName:           this.vendorName,
      deliveryNoteNumber:   formVal.deliveryNoteNumber || undefined,
      receivedBy:           formVal.receivedBy,
      receivedAt:           new Date(),
      deliveryAddress:      formVal.deliveryAddress,
      vehicleDetails:       formVal.vehicleDetails || undefined,
      driverName:           formVal.driverName || undefined,
      driverPhone:          formVal.driverPhone || undefined,
      overallCondition:     formVal.overallCondition,
      discrepancyNotes:     formVal.discrepancyNotes || undefined,
      items: formVal.items.map((it: any, i: number) => ({
        id:               this.grn?.items?.[i]?.id ?? 0,
        lpoItemId:        it.lpoItemId,
        name:             it.name,
        description:      '',
        orderedQuantity:  it.orderedQuantity,
        receivedQuantity: it.receivedQuantity,
        acceptedQuantity: it.acceptedQuantity,
        rejectedQuantity: it.rejectedQuantity,
        unit:             it.unit,
        unitPrice:        it.unitPrice,
        condition:        it.condition,
        batchNumber:      it.batchNumber || undefined,
        storageLocation:  it.storageLocation || undefined,
        notes:            it.notes || undefined
      })),
      status:             'DRAFT' as GrnStatus,
      totalOrderedValue:  orderedValue,
      totalReceivedValue: receivedValue,
      varianceAmount:     receivedValue - orderedValue,
      createdAt:          this.grn?.createdAt ?? new Date(),
      updatedAt:          new Date()
    };

    const action$ = this.grn?.id
      ? this.supplyChainService.updateGrn(this.grn.id, grnData)
      : this.supplyChainService.createGrn(grnData);

    action$.pipe(takeUntil(this.destroy$)).subscribe({
      next: (saved) => {
        this.grn = saved;
        this.isSubmittingGrn = false;
        this.showGrnForm = false;
        this.messageService.add({
          severity: 'success',
          summary: 'GRN Saved',
          detail: 'Goods Received Note has been saved as draft.'
        });
      },
      error: () => {
        this.isSubmittingGrn = false;
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Failed to save GRN. Please try again.'
        });
      }
    });
  }

  submitGrnForApproval(): void {
    if (!this.grn?.id) return;
    this.isSubmittingGrn = true;
    this.supplyChainService.submitGrn(this.grn.id).pipe(takeUntil(this.destroy$)).subscribe({
      next: (updated) => {
        this.grn = updated;
        this.isSubmittingGrn = false;
        this.messageService.add({
          severity: 'success',
          summary: 'GRN Submitted',
          detail: 'GRN submitted for approval. Finance will be notified.'
        });
      },
      error: () => {
        this.isSubmittingGrn = false;
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Failed to submit GRN for approval.'
        });
      }
    });
  }

  formatCurrency(amount: number, currency = 'NGN'): string {
    try {
      return new Intl.NumberFormat('en-NG', {
        style: 'currency',
        currency,
        maximumFractionDigits: 0
      }).format(amount);
    } catch {
      return `${currency} ${Math.round(amount).toLocaleString()}`;
    }
  }

  formatDate(date: Date | string | undefined): string {
    if (!date) return '—';
    try {
      return new Date(date).toLocaleDateString('en-NG', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
      });
    } catch {
      return String(date);
    }
  }

  getGrnStatusLabel(status: GrnStatus): string {
    const map: Record<GrnStatus, string> = {
      DRAFT:     'Draft',
      SUBMITTED: 'Submitted — Awaiting Approval',
      APPROVED:  'Approved',
      DISPUTED:  'Disputed',
      CANCELLED: 'Cancelled'
    };
    return map[status] ?? status;
  }

  getGrnStatusSeverity(status: GrnStatus): string {
    const map: Record<GrnStatus, string> = {
      DRAFT:     'info',
      SUBMITTED: 'warning',
      APPROVED:  'success',
      DISPUTED:  'danger',
      CANCELLED: 'danger'
    };
    return map[status] ?? 'info';
  }

  trackByIndex(index: number): number {
    return index;
  }
}

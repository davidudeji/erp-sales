// restock-request-form.component.ts
// ============================================================
// IMPORTS
// ============================================================

import { Component, OnInit, OnDestroy, Input, Output, EventEmitter } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { Location } from '@angular/common';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Subject, takeUntil, forkJoin } from 'rxjs';
import { InventoryService } from '../../../../service/inventory/inventory.service';
import {
  Branch,
  Product,
  BranchInventory,
  RestockRequest,
  RestockUrgency,
  RestockStatus,
  getStockStatus,
  getStockStatusLabel,
  getStockStatusColor,
  getMovementTypeLabel,
  getMovementTypeIcon,
  MovementType,
  MovementStatus
} from '../../../../domain/inventory/inventory.dto';

// ============================================================
// COMPONENT
// ============================================================

@Component({
  selector: 'app-restock-request-form',
  templateUrl: './restock-request-form.component.html',
  styleUrls: ['./restock-request-form.component.scss']
})
export class RestockRequestFormComponent implements OnInit, OnDestroy {

  // ============================================================
  // INPUTS / OUTPUTS
  // ============================================================

  @Input() requestId: string = '';
  @Input() mode: 'create' | 'edit' | 'view' = 'create';
  @Input() prefillData: any = null;
  @Output() saved = new EventEmitter<RestockRequest>();
  @Output() cancelled = new EventEmitter<void>();

  // ============================================================
  // STATE
  // ============================================================

  // Data
  request: RestockRequest | null = null;
  branches: Branch[] = [];
  products: Product[] = [];
  branchInventory: BranchInventory[] = [];
  filteredProducts: Product[] = [];
  isLoading: boolean = true;
  isSaving: boolean = false;
  error: string | null = null;

  // Forms
  requestForm!: FormGroup;

  // UI
  currentStep: number = 1;
  totalSteps: number = 3;
  showProductSearch: boolean = false;
  productSearchTerm: string = '';
  selectedProduct: Product | null = null;
  selectedProductInventory: BranchInventory | null = null;
  showConfirmDialog: boolean = false;
  confirmMessage: string = '';

  // Enums
  RestockUrgency = RestockUrgency;
  RestockStatus = RestockStatus;

  // Urgency options
  urgencyOptions = [
    { value: RestockUrgency.LOW, label: 'Low', color: '#3B82F6', icon: 'fa-arrow-down' },
    { value: RestockUrgency.MEDIUM, label: 'Medium', color: '#F59E0B', icon: 'fa-minus' },
    { value: RestockUrgency.HIGH, label: 'High', color: '#F97316', icon: 'fa-arrow-up' },
    { value: RestockUrgency.CRITICAL, label: 'Critical', color: '#DC2626', icon: 'fa-exclamation-triangle' }
  ];

  // Stock suggestions
  stockSuggestions: any[] = [];
  showSuggestions: boolean = false;

  // Private
  private destroy$ = new Subject<void>();

  // ============================================================
  // CONSTRUCTOR
  // ============================================================

  constructor(
    private inventoryService: InventoryService,
    private router: Router,
    private route: ActivatedRoute,
    private location: Location,
    private fb: FormBuilder
  ) {
    this.buildForm();
  }

  // ============================================================
  // LIFECYCLE HOOKS
  // ============================================================

  ngOnInit(): void {
    // Get requestId from route if not provided
    if (!this.requestId) {
      this.route.params.pipe(takeUntil(this.destroy$)).subscribe(params => {
        if (params['id']) {
          this.requestId = params['id'];
          this.mode = 'view';
        }
      });
    }

    // Get prefill data from query params
    this.route.queryParams.pipe(takeUntil(this.destroy$)).subscribe(params => {
      if (params['branchId']) {
        this.prefillData = { branchId: params['branchId'] };
      }
      if (params['productId']) {
        this.prefillData = { ...this.prefillData, productId: params['productId'] };
      }
    });

    this.loadData();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ============================================================
  // FORM BUILDING
  // ============================================================

  private buildForm(): void {
    this.requestForm = this.fb.group({
      branchId: ['', Validators.required],
      productId: ['', Validators.required],
      productName: [''],
      sku: [''],
      currentStock: [0],
      reorderPoint: [0],
      safetyStock: [0],
      requestedQuantity: ['', [Validators.required, Validators.min(1)]],
      urgency: [RestockUrgency.MEDIUM, Validators.required],
      preferredSupplier: [''],
      costEstimate: ['', [Validators.min(0)]],
      notes: [''],
      status: [RestockStatus.DRAFT]
    });
  }

  // ============================================================
  // DATA LOADING
  // ============================================================

  loadData(): void {
    this.isLoading = true;
    this.error = null;

    forkJoin({
      branches: this.inventoryService.getBranches(),
      products: this.inventoryService.getProducts({ limit: 200 }),
      inventory: this.inventoryService.getBranchInventory(this.prefillData?.branchId || '')
    }).pipe(takeUntil(this.destroy$))
      .subscribe({
        next: ({ branches, products, inventory }) => {
          this.branches = branches;

          // Apply prefill data
          if (this.prefillData) {
            if (this.prefillData.branchId) {
              this.branches = this.branches.filter(b => b.id === this.prefillData.branchId);
            }
            this.applyPrefill();
          }

          this.products = products.data;
          this.filteredProducts = products.data;
          this.branchInventory = inventory;

          // Load request if in edit/view mode
          if (this.requestId && (this.mode === 'edit' || this.mode === 'view')) {
            this.loadRequest();
          } else {
            this.isLoading = false;
            // Generate stock suggestions
            this.generateSuggestions();
          }
        },
        error: (err) => {
          console.error('Failed to load data:', err);
          this.error = 'Failed to load data. Please try again.';
          this.isLoading = false;
        }
      });
  }

  private loadRequest(): void {
    this.inventoryService.getRestockRequest(this.requestId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (request) => {
          this.request = request;
          this.populateForm(request);
          if (this.mode === 'view') {
            this.requestForm.disable();
          }
          this.isLoading = false;
        },
        error: (err) => {
          console.error('Failed to load request:', err);
          this.error = 'Failed to load request details';
          this.isLoading = false;
        }
      });
  }

  private populateForm(request: RestockRequest): void {
    this.requestForm.patchValue({
      branchId: request.branchId,
      productId: request.productId,
      productName: request.productName,
      sku: request.sku,
      currentStock: request.currentStock,
      reorderPoint: request.reorderPoint,
      safetyStock: request.safetyStock,
      requestedQuantity: request.requestedQuantity,
      urgency: request.urgency,
      preferredSupplier: request.preferredSupplier || '',
      costEstimate: request.costEstimate || 0,
      notes: request.notes || '',
      status: request.status
    });

    // Set selected product
    const product = this.products.find(p => String(p.id) === request.productId);
    if (product) {
      this.selectedProduct = product;
      this.productSearchTerm = product.name;
    }

    // Set selected product inventory
    const inventory = this.branchInventory.find(i => i.productId === request.productId);
    if (inventory) {
      this.selectedProductInventory = inventory;
    }
  }

  private applyPrefill(): void {
    if (this.prefillData?.branchId) {
      this.requestForm.patchValue({ branchId: this.prefillData.branchId });
      this.loadBranchInventory(this.prefillData.branchId);
    }

    if (this.prefillData?.productId) {
      const product = this.products.find(p => p.id === this.prefillData.productId);
      if (product) {
        this.selectProduct(product);
      }
    }
  }

  private loadBranchInventory(branchId: string): void {
    this.inventoryService.getBranchInventory(branchId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (inventory) => {
          this.branchInventory = inventory;
          this.generateSuggestions();
          // If product was pre-selected, find its inventory
          if (this.selectedProduct) {
            const inv = inventory.find(i => i.productId === String(this.selectedProduct?.id));
            if (inv) {
              this.selectedProductInventory = inv;
              this.updateStockFields(inv);
            }
          }
        },
        error: (err) => console.error('Failed to load branch inventory:', err)
      });
  }

  // ============================================================
  // PRODUCT SELECTION
  // ============================================================

  onProductSearch(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.productSearchTerm = input.value;
    if (this.productSearchTerm.length > 0) {
      this.filteredProducts = this.products.filter(p =>
        p.name.toLowerCase().includes(this.productSearchTerm.toLowerCase()) ||
        p.sku.toLowerCase().includes(this.productSearchTerm.toLowerCase())
      );
    } else {
      this.filteredProducts = this.products;
    }
    this.showProductSearch = true;
  }

  hideProductSearch(): void {
    setTimeout(() => {
      this.showProductSearch = false;
    }, 200);
  }

  selectProduct(product: Product): void {
    this.selectedProduct = product;
    this.productSearchTerm = product.name;
    this.showProductSearch = false;

    // Find inventory for this product in the selected branch
    const inventory = this.branchInventory.find(i => i.productId === String(product.id));
    if (inventory) {
      this.selectedProductInventory = inventory;
      this.updateStockFields(inventory);
    } else {
      this.selectedProductInventory = null;
      // Product not in this branch
      this.requestForm.patchValue({
        productId: product.id,
        productName: product.name,
        sku: product.sku,
        currentStock: 0,
        reorderPoint: 0,
        safetyStock: 0
      });
      this.error = 'This product is not currently in the selected branch inventory.';
    }
  }

  onBranchChange(): void {
    const branchId = this.requestForm.get('branchId')?.value;
    if (branchId) {
      this.loadBranchInventory(branchId);
      // Reset product selection
      this.selectedProduct = null;
      this.selectedProductInventory = null;
      this.requestForm.patchValue({
        productId: '',
        productName: '',
        sku: '',
        currentStock: 0,
        reorderPoint: 0,
        safetyStock: 0,
        requestedQuantity: ''
      });
      this.productSearchTerm = '';
    }
  }

  private updateStockFields(inventory: BranchInventory): void {
    const status = getStockStatus(inventory.quantity, inventory.reorderPoint, inventory.safetyStock);
    this.requestForm.patchValue({
      productId: inventory.productId,
      productName: inventory.productName,
      sku: inventory.sku,
      currentStock: inventory.quantity,
      reorderPoint: inventory.reorderPoint,
      safetyStock: inventory.safetyStock
    });

    // Auto-suggest quantity based on stock status
    let suggestedQty = 0;
    if (status === 'CRITICAL' || status === 'LOW') {
      suggestedQty = Math.max(inventory.reorderPoint * 2 - inventory.quantity, inventory.reorderPoint);
    } else {
      suggestedQty = inventory.reorderPoint;
    }
    this.requestForm.patchValue({ requestedQuantity: suggestedQty });

    // Auto-set urgency based on stock status
    if (status === 'CRITICAL') {
      this.requestForm.patchValue({ urgency: RestockUrgency.CRITICAL });
    } else if (status === 'LOW') {
      this.requestForm.patchValue({ urgency: RestockUrgency.HIGH });
    }
  }

  // ============================================================
  // SUGGESTIONS
  // ============================================================

  private generateSuggestions(): void {
    this.stockSuggestions = this.branchInventory
      .filter(item => {
        const status = getStockStatus(item.quantity, item.reorderPoint, item.safetyStock);
        return status === 'CRITICAL' || status === 'LOW';
      })
      .slice(0, 5)
      .map(item => ({
        productId: item.productId,
        productName: item.productName,
        sku: item.sku,
        currentStock: item.quantity,
        reorderPoint: item.reorderPoint,
        safetyStock: item.safetyStock,
        suggestedQuantity: Math.max(item.reorderPoint * 2 - item.quantity, item.reorderPoint),
        urgency: getStockStatus(item.quantity, item.reorderPoint, item.safetyStock) === 'CRITICAL'
          ? RestockUrgency.CRITICAL
          : RestockUrgency.HIGH,
        status: getStockStatus(item.quantity, item.reorderPoint, item.safetyStock)
      }));
  }

  applySuggestion(suggestion: any): void {
    // Find the product
    const product = this.products.find(p => p.id === suggestion.productId);
    if (product) {
      // Switch to step 1 if not already
      if (this.currentStep > 1) {
        this.currentStep = 1;
      }
      // Set the branch
      const branchId = this.requestForm.get('branchId')?.value;
      if (branchId) {
        // Select the product
        this.selectProduct(product);
        // Override the suggested quantity
        this.requestForm.patchValue({
          requestedQuantity: suggestion.suggestedQuantity,
          urgency: suggestion.urgency
        });
        // Auto-advance to step 2
        setTimeout(() => {
          if (this.validateCurrentStep()) {
            this.currentStep = 2;
          }
        }, 300);
      }
    }
    this.showSuggestions = false;
  }

  toggleSuggestions(): void {
    this.showSuggestions = !this.showSuggestions;
  }

  // ============================================================
  // STEP NAVIGATION
  // ============================================================

  goToStep(step: number): void {
    if (step < 1 || step > this.totalSteps) return;
    if (step > this.currentStep && !this.validateCurrentStep()) return;
    this.currentStep = step;
    this.error = null;
  }

  nextStep(): void {
    if (this.validateCurrentStep()) {
      if (this.currentStep < this.totalSteps) {
        this.currentStep++;
        this.error = null;
      }
    }
  }

  prevStep(): void {
    if (this.currentStep > 1) {
      this.currentStep--;
      this.error = null;
    }
  }

  private validateCurrentStep(): boolean {
    switch (this.currentStep) {
      case 1:
        if (!this.requestForm.get('branchId')?.value) {
          this.error = 'Please select a branch';
          return false;
        }
        if (!this.selectedProduct) {
          this.error = 'Please select a product';
          return false;
        }
        return true;
      case 2:
        if (!this.requestForm.get('requestedQuantity')?.value ||
          parseInt(this.requestForm.get('requestedQuantity')?.value) <= 0) {
          this.error = 'Please enter a valid quantity';
          return false;
        }
        return true;
      default:
        return true;
    }
  }

  // ============================================================
  // SAVE
  // ============================================================

  save(): void {
    if (this.requestForm.invalid) {
      this.requestForm.markAllAsTouched();
      this.error = 'Please fix all validation errors';
      return;
    }

    if (this.mode === 'view') {
      this.cancelled.emit();
      this.navigateAway();
      return;
    }

    this.isSaving = true;
    this.error = null;

    const formValue = this.requestForm.value;
    const data: Partial<RestockRequest> = {
      branchId: formValue.branchId,
      branchName: this.getBranchName(formValue.branchId),
      productId: formValue.productId,
      productName: formValue.productName,
      sku: formValue.sku,
      currentStock: parseInt(formValue.currentStock) || 0,
      reorderPoint: parseInt(formValue.reorderPoint) || 0,
      safetyStock: parseInt(formValue.safetyStock) || 0,
      requestedQuantity: parseInt(formValue.requestedQuantity),
      urgency: formValue.urgency,
      preferredSupplier: formValue.preferredSupplier || '',
      costEstimate: parseFloat(formValue.costEstimate) || 0,
      notes: formValue.notes || '',
      status: this.mode === 'edit' ? formValue.status : RestockStatus.PENDING
    };

    if (this.mode === 'edit' && this.requestId) {
      // Update existing request
      this.inventoryService.updateRestockRequest(this.requestId, data)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (result) => {
            this.isSaving = false;
            this.saved.emit(result);
            this.navigateAway();
          },
          error: (err) => {
            console.error('Failed to update request:', err);
            this.error = 'Failed to update request. Please try again.';
            this.isSaving = false;
          }
        });
    } else {
      // Create new request
      this.inventoryService.createRestockRequest(data)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (result) => {
            this.isSaving = false;
            this.saved.emit(result);
            this.navigateAway();
          },
          error: (err) => {
            console.error('Failed to create request:', err);
            this.error = 'Failed to create request. Please try again.';
            this.isSaving = false;
          }
        });
    }
  }

  // ============================================================
  // CANCEL
  // ============================================================

  cancel(): void {
    if (this.requestForm.dirty && this.mode !== 'view') {
      this.showConfirmDialog = true;
      this.confirmMessage = 'You have unsaved changes. Are you sure you want to leave?';
    } else {
      this.cancelled.emit();
      this.navigateAway();
    }
  }

  confirmCancel(): void {
    this.showConfirmDialog = false;
    this.cancelled.emit();
    this.navigateAway();
  }

  /** Falls back to browser history when nothing is listening to saved/cancelled — this component is currently only ever routed to directly, never embedded. */
  private navigateAway(): void {
    if (!this.saved.observed && !this.cancelled.observed) {
      this.location.back();
    }
  }

  cancelConfirmDialog(): void {
    this.showConfirmDialog = false;
  }

  // ============================================================
  // UTILITY HELPERS
  // ============================================================

  getBranchName(branchId: string): string {
    const branch = this.branches.find(b => String(b.id) === branchId);
    return branch?.name || branchId;
  }

  getBranchInventory(productId: string | number): BranchInventory | undefined {
    return this.branchInventory.find(i => String(i.productId) === String(productId));
  }

  getBranchTypeLabel(type: string): string {
    const map: Record<string, string> = {
      'FLAGSHIP': 'Flagship',
      'STANDARD': 'Standard',
      'MINI': 'Mini'
    };
    return map[type] || type;
  }

  getStockStatus(quantity: number, reorderPoint: number, safetyStock: number): 'CRITICAL' | 'LOW' | 'NORMAL' | 'OVERSTOCK' {
    return getStockStatus(quantity, reorderPoint, safetyStock);
  }

  getStockStatusLabel(status: 'CRITICAL' | 'LOW' | 'NORMAL' | 'OVERSTOCK'): string {
    return getStockStatusLabel(status);
  }

  getStockStatusColor(status: 'CRITICAL' | 'LOW' | 'NORMAL' | 'OVERSTOCK'): string {
    return getStockStatusColor(status);
  }

  getUrgencyLabel(urgency: string): string {
    return urgency.replace(/_/g, ' ').toLowerCase()
      .replace(/\b\w/g, l => l.toUpperCase());
  }

  getUrgencyColor(urgency: string): string {
    const map: Record<string, string> = {
      [RestockUrgency.CRITICAL]: '#DC2626',
      [RestockUrgency.HIGH]: '#F97316',
      [RestockUrgency.MEDIUM]: '#F59E0B',
      [RestockUrgency.LOW]: '#3B82F6'
    };
    return map[urgency] || '#6B7280';
  }

  getStatusLabel(status: string): string {
    return status.replace(/_/g, ' ').toLowerCase()
      .replace(/\b\w/g, l => l.toUpperCase());
  }

  getStatusColor(status: string): string {
    const map: Record<string, string> = {
      [RestockStatus.DRAFT]: '#6B7280',
      [RestockStatus.PENDING]: '#F59E0B',
      [RestockStatus.APPROVED]: '#3B82F6',
      [RestockStatus.REJECTED]: '#DC2626',
      [RestockStatus.ORDERED]: '#8B5CF6',
      [RestockStatus.RECEIVED]: '#2EB270'
    };
    return map[status] || '#6B7280';
  }

  getStatusBadgeClass(status: string): string {
    const map: Record<string, string> = {
      [RestockStatus.DRAFT]: 'draft',
      [RestockStatus.PENDING]: 'pending',
      [RestockStatus.APPROVED]: 'approved',
      [RestockStatus.REJECTED]: 'rejected',
      [RestockStatus.ORDERED]: 'ordered',
      [RestockStatus.RECEIVED]: 'received'
    };
    return map[status] || 'draft';
  }

  formatCurrency(value: number): string {
    if (!value) return '₦0';
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  }

  getStockStatusClass(status: string): string {
    const map = {
      'CRITICAL': 'critical',
      'LOW': 'low',
      'NORMAL': 'normal',
      'OVERSTOCK': 'overstock'
    };
    return map[status as keyof typeof map] || 'normal';
  }

  isFieldInvalid(fieldName: string): boolean {
    const control = this.requestForm.get(fieldName);
    return !!control?.invalid && !!control?.touched;
  }

  getFieldError(fieldName: string): string {
    const control = this.requestForm.get(fieldName);
    if (!control || !control.errors) return '';

    const errors = control.errors;
    if (errors['required']) return 'This field is required';
    if (errors['min']) return `Minimum value is ${errors['min'].min}`;
    if (errors['pattern']) return 'Invalid format';

    return 'Invalid input';
  }

  getStepStatus(step: number): 'complete' | 'current' | 'incomplete' {
    if (step < this.currentStep) return 'complete';
    if (step === this.currentStep) return 'current';
    return 'incomplete';
  }

  isStepValid(step: number): boolean {
    switch (step) {
      case 1:
        return !!this.selectedProduct && !!this.requestForm.get('branchId')?.value;
      case 2:
        return !!this.requestForm.get('requestedQuantity')?.value &&
          parseInt(this.requestForm.get('requestedQuantity')?.value) > 0;
      default:
        return true;
    }
  }

  // ============================================================
  // REFRESH
  // ============================================================

  refresh(): void {
    this.loadData();
  }
}
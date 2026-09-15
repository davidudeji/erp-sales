// transfer-wizard.component.ts
import { Component, OnInit, OnDestroy, Output, EventEmitter } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormBuilder, FormGroup, Validators, FormArray } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { InventoryService } from '../../../../service/inventory/inventory.service';
import {
  Branch,
  Product,
  BranchInventory,
  StockMovement,
  MovementType,
  getMovementTypeLabel
} from '../../../../domain/inventory/inventory.dto';

// ============================================================
// COMPONENT
// ============================================================

@Component({
  selector: 'app-transfer-wizard',
  templateUrl: './transfer-wizard.component.html',
  styleUrls: ['./transfer-wizard.component.scss']
})
export class TransferWizardComponent implements OnInit, OnDestroy {

  // ============================================================
  // OUTPUTS
  // ============================================================

  @Output() completed = new EventEmitter<StockMovement>();
  @Output() cancelled = new EventEmitter<void>();

  // ============================================================
  // STATE
  // ============================================================

  // Data
  branches: Branch[] = [];
  // When a caller links in with ?lockedBranchId=<id> (e.g. the Branch Manager tab's "Create
  // Transfer" quick action), that one branch is fixed on either the Source or Destination side —
  // whichever the user picks via the direction toggle below — and the other side offers every
  // other ACTIVE branch. Outside that flow (plain /movements/transfer), lockedBranchId is null,
  // no direction toggle is shown, and both dropdowns just list every branch as before.
  lockedBranchId: string | null = null;
  direction: 'FROM' | 'TO' | null = null;
  sourceBranches: Branch[] = [];
  destinationBranches: Branch[] = [];
  products: Product[] = [];
  sourceInventory: BranchInventory[] = [];
  destInventory: BranchInventory[] = [];
  filteredProducts: Product[] = [];
  isLoading: boolean = true;
  isSubmitting: boolean = false;
  error: string | null = null;

  // Wizard
  currentStep: number = 1;
  totalSteps: number = 4;
  stepTitles = ['Select Source', 'Select Products', 'Select Destination', 'Review & Confirm'];

  // Forms
  wizardForm!: FormGroup;

  // Product selection
  productSearchTerm: string = '';
  showProductDropdown: boolean = false;
  selectedProducts: Map<number, { product: Product; quantity: number; sourceStock: number; destinationStock?: number }> = new Map();

  // UI
  Math = Math;
  showConfirmDialog: boolean = false;
  confirmMessage: string = '';

  // Private
  private destroy$ = new Subject<void>();

  // ============================================================
  // CONSTRUCTOR
  // ============================================================

  constructor(
    private inventoryService: InventoryService,
    private router: Router,
    private route: ActivatedRoute,
    private fb: FormBuilder
  ) {
    this.buildForm();
  }

  // ============================================================
  // LIFECYCLE HOOKS
  // ============================================================

  ngOnInit(): void {
    this.lockedBranchId = this.route.snapshot.queryParamMap.get('lockedBranchId');
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
    this.wizardForm = this.fb.group({
      sourceBranchId: ['', Validators.required],
      destinationBranchId: ['', Validators.required],
      items: this.fb.array([]),
      notes: [''],
      priority: ['MEDIUM']
    });
  }

  private createItemForm(): FormGroup {
    return this.fb.group({
      productId: ['', Validators.required],
      productName: [''],
      sku: [''],
      quantity: ['', [Validators.required, Validators.min(1)]],
      sourceStock: [0],
      destinationStock: [0]
    });
  }

  // ============================================================
  // GETTERS
  // ============================================================

  get items(): FormArray {
    return this.wizardForm.get('items') as FormArray;
  }

  get sourceBranchId(): string {
    return this.wizardForm.get('sourceBranchId')?.value;
  }

  get destinationBranchId(): string {
    return this.wizardForm.get('destinationBranchId')?.value;
  }

  // ============================================================
  // DATA LOADING
  // ============================================================

  loadData(): void {
    this.isLoading = true;
    this.error = null;

    // Load branches
    this.inventoryService.getBranches()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (branches: Branch[]) => {
          this.branches = branches;
          if (this.lockedBranchId) {
            // Direction not chosen yet — chooseDirection() populates these once it is.
            this.sourceBranches = [];
            this.destinationBranches = [];
          } else {
            this.sourceBranches = branches;
            this.destinationBranches = branches;
          }
          this.checkLoadingComplete();
        },
        error: (err: any) => {
          console.error('Failed to load branches:', err);
          this.error = 'Failed to load branches. Please try again.';
          this.isLoading = false;
        }
      });

    // Load products
    this.inventoryService.getProducts({ limit: 200 })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response: any) => {
          this.products = response.data;
          this.filteredProducts = response.data;
          this.checkLoadingComplete();
        },
        error: (err: any) => {
          console.error('Failed to load products:', err);
          this.error = 'Failed to load products. Please try again.';
          this.isLoading = false;
        }
      });
  }

  private checkLoadingComplete(): void {
    if (this.branches.length > 0 && this.products.length > 0) {
      this.isLoading = false;
    }
  }

  // ============================================================
  // BRANCH SELECTION
  // ============================================================

  /** Only relevant when lockedBranchId is set (Branch Manager tab). Fixes the locked branch
   *  on the chosen side and offers every other ACTIVE branch on the other side — 'FROM' sends
   *  stock out of the locked branch, 'TO' requests stock be moved into it. Switching direction
   *  clears whatever branches/products were already picked so nothing stale carries over. */
  chooseDirection(direction: 'FROM' | 'TO'): void {
    if (!this.lockedBranchId) return;
    this.direction = direction;

    const lockedBranch = this.branches.filter(b => String(b.id) === this.lockedBranchId);
    const otherActiveBranches = this.branches.filter(b => String(b.id) !== this.lockedBranchId && b.status === 'ACTIVE');

    this.sourceBranches = direction === 'FROM' ? lockedBranch : otherActiveBranches;
    this.destinationBranches = direction === 'FROM' ? otherActiveBranches : lockedBranch;

    this.wizardForm.patchValue({ sourceBranchId: '', destinationBranchId: '' });
    this.items.clear();
    this.selectedProducts.clear();
    this.sourceInventory = [];
    this.destInventory = [];
    this.error = null;

    if (direction === 'FROM' && lockedBranch.length === 1) {
      this.wizardForm.patchValue({ sourceBranchId: lockedBranch[0].id });
      this.onSourceBranchChange();
    } else if (direction === 'TO' && lockedBranch.length === 1) {
      this.wizardForm.patchValue({ destinationBranchId: lockedBranch[0].id });
      this.onDestinationBranchChange();
    }
  }

  onSourceBranchChange(): void {
    if (this.sourceBranchId) {
      this.loadSourceInventory();
      // Clear existing items
      this.items.clear();
      this.selectedProducts.clear();
      this.productSearchTerm = '';
    }
  }

  onDestinationBranchChange(): void {
    if (this.destinationBranchId) {
      this.loadDestinationInventory();
    }
  }

  loadSourceInventory(): void {
    if (!this.sourceBranchId) return;

    this.inventoryService.getBranchInventory(this.sourceBranchId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (inventory: BranchInventory[]) => {
          this.sourceInventory = inventory;
          // Update selected products with source stock
          this.selectedProducts.forEach((value, key) => {
            const item = inventory.find((i: BranchInventory) => i.productId === String(key));
            value.sourceStock = item?.quantity || 0;
          });
        },
        error: (err: any) => {
          console.error('Failed to load source inventory:', err);
        }
      });
  }

  loadDestinationInventory(): void {
    if (!this.destinationBranchId) return;

    this.inventoryService.getBranchInventory(this.destinationBranchId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (inventory: BranchInventory[]) => {
          this.destInventory = inventory;
          // Update selected products with destination stock
          this.selectedProducts.forEach((value, key) => {
            const item = inventory.find((i: BranchInventory) => i.productId === String(key));
            value.destinationStock = item?.quantity || 0;
          });
        },
        error: (err: any) => {
          console.error('Failed to load destination inventory:', err);
        }
      });
  }

  // ============================================================
  // PRODUCT SEARCH
  // ============================================================

  onProductSearch(event: Event): void {
    const searchTerm = (event.target as HTMLInputElement).value;
    this.productSearchTerm = searchTerm;
    if (searchTerm.length > 0) {
      this.filteredProducts = this.products.filter(p =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.sku.toLowerCase().includes(searchTerm.toLowerCase())
      );
    } else {
      this.filteredProducts = this.products;
    }
    this.showProductDropdown = true;
  }

  hideProductDropdown(): void {
    setTimeout(() => {
      this.showProductDropdown = false;
    }, 200);
  }

  selectProduct(product: Product): void {
    // Check if product already added
    if (this.selectedProducts.has(product.id)) {
      this.error = 'Product already added to transfer';
      this.showProductDropdown = false;
      this.productSearchTerm = '';
      return;
    }

    // The Quick Transfer wizard is for moving a single product; anything more belongs in Bulk
    // Transfer instead (it's built for exactly that — many products in one transfer). The exact
    // wording is checked by isBulkTransferSuggested() below to show a "Go to Bulk Transfer"
    // button alongside this specific error, without needing a separate flag to keep in sync with
    // every other place `error` gets cleared.
    if (this.items.length >= 1) {
      this.error = 'Quick Transfer only supports one product at a time. Use Bulk Transfer to move multiple products in one go.';
      this.showProductDropdown = false;
      this.productSearchTerm = '';
      return;
    }

    // Check if product exists in source inventory
    const sourceItem = this.sourceInventory.find((i: BranchInventory) => i.productId === String(product.id));
    if (!sourceItem || sourceItem.quantity <= 0) {
      this.error = 'Product not available in source branch';
      this.showProductDropdown = false;
      this.productSearchTerm = '';
      return;
    }

    // Add to selected products
    this.selectedProducts.set(product.id, {
      product: product,
      quantity: 1,
      sourceStock: sourceItem.quantity,
      destinationStock: this.destInventory.find((i: BranchInventory) => i.productId === String(product.id))?.quantity || 0
    });

    // Add to form
    const item = this.createItemForm();
    item.patchValue({
      productId: product.id,
      productName: product.name,
      sku: product.sku,
      quantity: 1,
      sourceStock: sourceItem.quantity,
      destinationStock: this.destInventory.find((i: BranchInventory) => i.productId === String(product.id))?.quantity || 0
    });
    this.items.push(item);

    this.showProductDropdown = false;
    this.productSearchTerm = '';
    this.error = null;
  }

  removeProduct(productId: string | number, index: number): void {
    this.selectedProducts.delete(Number(productId));
    this.items.removeAt(index);
  }

  updateQuantity(index: number): void {
    const item = this.items.at(index);
    const productId = item.get('productId')?.value;
    const quantity = parseInt(item.get('quantity')?.value || 0);
    if (productId && this.selectedProducts.has(productId)) {
      const selected = this.selectedProducts.get(productId)!;
      selected.quantity = quantity;
    }
  }

  // ============================================================
  // WIZARD NAVIGATION
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
        if (!this.sourceBranchId || this.sourceBranchId === this.destinationBranchId) {
          if (this.sourceBranchId === this.destinationBranchId) {
            this.error = 'Source and destination branches cannot be the same';
          } else {
            this.error = 'Please select a source branch';
          }
          return false;
        }
        return true;
      case 2:
        if (this.items.length === 0) {
          this.error = 'Please add at least one product to transfer';
          return false;
        }
        // Validate quantities don't exceed source stock
        for (let i = 0; i < this.items.length; i++) {
          const item = this.items.at(i);
          const quantity = parseInt(item.get('quantity')?.value || 0);
          const sourceStock = parseInt(item.get('sourceStock')?.value || 0);
          if (quantity > sourceStock) {
            const productName = item.get('productName')?.value;
            this.error = `Insufficient stock for ${productName}. Available: ${sourceStock}`;
            return false;
          }
        }
        return true;
      case 3:
        if (!this.destinationBranchId) {
          this.error = 'Please select a destination branch';
          return false;
        }
        if (this.sourceBranchId === this.destinationBranchId) {
          this.error = 'Source and destination branches cannot be the same';
          return false;
        }
        return true;
      default:
        return true;
    }
  }

  // ============================================================
  // SUBMIT
  // ============================================================

  submitTransfer(): void {
    if (!this.validateCurrentStep()) return;

    this.isSubmitting = true;
    this.error = null;

    const formValue = this.wizardForm.value;
    const items: any[] = formValue.items;
    const sourceBranchId = formValue.sourceBranchId;
    const destinationBranchId = formValue.destinationBranchId;
    const sourceBranchName = this.getBranchName(sourceBranchId);
    const destinationBranchName = this.getBranchName(destinationBranchId);

    let firstMovement: StockMovement | null = null;
    let failedProductName: string | null = null;
    let failureMessage = '';

    // Transfers only ever get recorded as PENDING here — stock does not move yet. A transfer
    // must be approved (via the Movement Approvals page, or a manual status update to COMPLETED)
    // before InventoryService actually adjusts branch inventory; see
    // InventoryService.applyTransferStockAdjustment().
    //
    // NOTE: createMovement() is a localStorage-backed mock that resolves synchronously (via
    // `of(...)`), so this plain for-loop completes in one tick — no concatMap needed.
    for (const item of items) {
      if (failedProductName) break;

      const quantity = parseInt(item.quantity, 10) || 0;
      const sourceItem = this.sourceInventory.find(i => i.productId === item.productId);
      if (!sourceItem || sourceItem.quantity < quantity) {
        failedProductName = item.productName;
        failureMessage = `Insufficient stock for ${item.productName}. Available: ${sourceItem?.quantity || 0}`;
        break;
      }

      this.inventoryService.createMovement({
        productId: item.productId,
        productName: item.productName,
        sku: item.sku,
        quantity,
        movementType: MovementType.TRANSFER,
        fromLocation: { type: 'BRANCH', id: sourceBranchId, name: sourceBranchName },
        toLocation: { type: 'BRANCH', id: destinationBranchId, name: destinationBranchName },
        notes: formValue.notes || ''
      }).subscribe({
        next: (movement) => {
          if (!firstMovement) {
            firstMovement = movement;
          }
        },
        error: (err) => {
          failedProductName = item.productName;
          failureMessage = err?.message || `Failed to record movement for ${item.productName}`;
        }
      });
    }

    this.isSubmitting = false;

    if (failedProductName) {
      this.error = failureMessage;
      return;
    }

    if (firstMovement) {
      this.completed.emit(firstMovement);
    }

    // A Branch Manager (this form locked to their branch) goes back to their own dashboard,
    // where the new transfer shows up as a pending request — not into the admin approval
    // queue, which they have no reason to see. Everyone else still lands on Approvals.
    //
    // Routed to the tab shell itself (not the standalone /branch-manager route) so the
    // nav-tab bar comes back too — the shell remembers "Branch Manager" was the last tab
    // selected (that's how they got to this form in the first place) and restores it.
    if (this.lockedBranchId) {
      this.router.navigate(['/admin/sales/commerce/inventory']);
    } else {
      this.router.navigate(['/admin/sales/commerce/inventory/movements/approvals']);
    }
  }

  // ============================================================
  // CANCEL
  // ============================================================

  cancel(): void {
    if (this.items.length > 0 || this.wizardForm.dirty) {
      this.showConfirmDialog = true;
      this.confirmMessage = 'You have unsaved changes. Are you sure you want to leave?';
    } else {
      this.cancelled.emit();
      this.router.navigate(['/admin/sales/commerce/inventory']);
    }
  }

  confirmCancel(): void {
    this.showConfirmDialog = false;
    this.cancelled.emit();
    this.router.navigate(['/admin/sales/commerce/inventory']);
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

  /** True while the current error is specifically the "one product at a time" message, so the
   *  template can show a "Go to Bulk Transfer" button alongside it. */
  isBulkTransferSuggested(): boolean {
    return !!this.error?.includes('Use Bulk Transfer');
  }

  goToBulkTransfer(): void {
    this.router.navigate(['/admin/sales/commerce/inventory/movements/bulk-transfer']);
  }

  getSourceStock(productId: string | number): number {
    const item = this.sourceInventory.find(i => String(i.productId) === String(productId));
    return item?.quantity || 0;
  }

  getDestinationStock(productId: string | number): number {
    const item = this.destInventory.find(i => String(i.productId) === String(productId));
    return item?.quantity || 0;
  }

  getTotalItems(): number {
    return this.items.value.reduce((sum: number, item: any) => sum + (parseInt(item.quantity) || 0), 0);
  }

  getMovementTypeLabel(type: string): string {
    return getMovementTypeLabel(type as MovementType);
  }

  getStepStatus(step: number): 'complete' | 'current' | 'incomplete' {
    if (step < this.currentStep) return 'complete';
    if (step === this.currentStep) return 'current';
    return 'incomplete';
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

  isStepValid(step: number): boolean {
    switch (step) {
      case 1:
        return !!this.sourceBranchId && !!this.destinationBranchId &&
          this.sourceBranchId !== this.destinationBranchId;
      case 2:
        return this.items.length > 0;
      case 3:
        return !!this.destinationBranchId && this.sourceBranchId !== this.destinationBranchId;
      default:
        return true;
    }
  }
}
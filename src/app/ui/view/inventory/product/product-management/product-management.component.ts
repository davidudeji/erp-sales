import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { Product, Category, MeasurementUnit, Supplier } from '../../../../domain/inventory/inventory.dto';
import { InventoryService } from '../../../../service/inventory/inventory.service';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';

@Component({
  selector: 'app-product-management',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, ToastModule],
  providers: [MessageService],
  templateUrl: './product-management.component.html',
  styleUrl: './product-management.component.scss'
})
export class ProductManagementComponent implements OnInit, OnDestroy {

  protected readonly Math = Math;

  viewMode: 'list' | 'icon' = 'list';
  products: any[] = [];
  isLoading = true;
  selectedProductIds: any[] = [];
  aiDismissed = false;
  showDeleteModal = false;
  pendingDeleteProductName = '';
  pendingDeleteProductObj: Product | null = null;

  setViewMode(mode: 'list' | 'icon'): void {
    this.viewMode = mode;
  }

  // Filters
  filters = {
    status: 'ALL',
    category: 'ALL',
    searchTerm: '',
    minPrice: '',
    maxPrice: '',
    page: 0,
    size: 10
  };

  // Pagination
  currentPage = 0;
  pageSize = 10;
  totalElements = 0;
  totalPages = 0;

  // Stats
  stats = {
    total: 0,
    active: 0,
    outOfStock: 0,
    discontinued: 0,
    totalValue: 0
  };

  // Categories for filter (dynamically loaded)
  categories: string[] = ['ALL'];
  rawCategories: Category[] = [];
  showCategoryModal = false;
  newCategoryName = '';
  newCategoryDesc = '';
  editingCategory: Category | null = null;
  viewingCategoryDetails: Category | null = null;

  // Measurement Units
  rawUnits: MeasurementUnit[] = [];
  showUnitModal = false;
  newUnitName = '';
  newUnitCode = '';
  newUnitDesc = '';
  editingUnit: MeasurementUnit | null = null;
  viewingUnitDetails: MeasurementUnit | null = null;

  // Suppliers
  rawSuppliers: Supplier[] = [];
  showSupplierModal = false;
  newSupplierName = '';
  newSupplierEmail = '';
  newSupplierPhone = '';
  newSupplierAddress = '';
  newSupplierContactPerson = '';
  editingSupplier: Supplier | null = null;
  viewingSupplierDetails: Supplier | null = null;

  statusOptions: { value: string; label: string; color: string }[] = [
    { value: 'ALL', label: 'All Products', color: 'gray' },
    { value: 'ACTIVE', label: 'Active', color: 'green' },
    { value: 'OUT_OF_STOCK', label: 'Out of Stock', color: 'orange' },
    { value: 'DISCONTINUED', label: 'Discontinued', color: 'red' }
  ];

  private destroy$ = new Subject<void>();

  constructor(
    private messageService: MessageService,
    private inventoryService: InventoryService,
    private router: Router,
    private route: ActivatedRoute
  ) { }

  ngOnInit(): void {
    this.loadCategories();
    this.loadUnits();
    this.loadSuppliers();
    this.loadProducts();
  }

  loadCategories(): void {
    this.inventoryService.getCategories().pipe(takeUntil(this.destroy$)).subscribe({
      next: (cats: Category[]) => {
        this.rawCategories = cats;
        this.categories = ['ALL', ...cats.map((c: Category) => c.name)];
      }
    });
  }

  openCategoryModal(): void {
    console.log('openCategoryModal: showCategoryModal set to true');
    this.showCategoryModal = true;
    this.editingCategory = null;
    this.viewingCategoryDetails = null;
    this.newCategoryName = '';
    this.newCategoryDesc = '';
  }

  closeCategoryModal(): void {
    this.showCategoryModal = false;
    this.editingCategory = null;
    this.viewingCategoryDetails = null;
    this.newCategoryName = '';
    this.newCategoryDesc = '';
  }

  startEditCategory(cat: Category): void {
    this.editingCategory = cat;
    this.viewingCategoryDetails = null;
    this.newCategoryName = cat.name;
    this.newCategoryDesc = cat.description || '';
  }

  startViewCategory(cat: Category): void {
    this.viewingCategoryDetails = cat;
    this.editingCategory = null;
  }

  closeCategoryDetails(): void {
    this.viewingCategoryDetails = null;
  }

  cancelEditCategory(): void {
    this.editingCategory = null;
    this.newCategoryName = '';
    this.newCategoryDesc = '';
  }

  submitCategory(): void {
    const trimmedName = this.newCategoryName.trim();
    if (!trimmedName) {
      this.messageService.add({ severity: 'warn', summary: 'Warning', detail: 'Please enter a category name' });
      return;
    }

    if (this.editingCategory) {
      // Update Mode
      const isDuplicate = this.rawCategories.some(
        c => c.id !== this.editingCategory?.id && c.name.toLowerCase() === trimmedName.toLowerCase()
      );
      if (isDuplicate) {
        this.messageService.add({ severity: 'warn', summary: 'Warning', detail: 'Another category already has this name' });
        return;
      }

      this.inventoryService.updateCategory(this.editingCategory.id, {
        name: trimmedName,
        description: this.newCategoryDesc.trim()
      }).pipe(takeUntil(this.destroy$)).subscribe({
        next: (updatedCats: Category[]) => {
          this.rawCategories = updatedCats;
          this.categories = ['ALL', ...updatedCats.map((c: Category) => c.name)];
          this.cancelEditCategory();
          this.messageService.add({ severity: 'success', summary: 'Success', detail: 'Category updated successfully!' });
        },
        error: (err: any) => {
          console.error('Error updating category:', err);
          this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to update category' });
        }
      });
    } else {
      // Create Mode
      if (this.rawCategories.some(c => c.name.toLowerCase() === trimmedName.toLowerCase())) {
        this.messageService.add({ severity: 'warn', summary: 'Warning', detail: 'Category already exists' });
        return;
      }

      this.inventoryService.createCategory({
        name: trimmedName,
        description: this.newCategoryDesc.trim()
      }).pipe(takeUntil(this.destroy$)).subscribe({
        next: (updatedCats: Category[]) => {
          this.rawCategories = updatedCats;
          this.categories = ['ALL', ...updatedCats.map((c: Category) => c.name)];
          this.newCategoryName = '';
          this.newCategoryDesc = '';
          this.messageService.add({ severity: 'success', summary: 'Success', detail: 'Category added successfully!' });
          alert(`Category "${trimmedName}" has been created successfully.`);
        },
        error: (err: any) => {
          console.error('Error adding category:', err);
          this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to add category' });
        }
      });
    }
  }

  confirmDeleteCategory(id: string | number, name: string): void {
    if (confirm(`Are you sure you want to delete the category "${name}"?`)) {
      this.inventoryService.deleteCategory(Number(id)).pipe(takeUntil(this.destroy$)).subscribe({
        next: (updatedCats: Category[]) => {
          this.rawCategories = updatedCats;
          this.categories = ['ALL', ...updatedCats.map((c: Category) => c.name)];
          if (this.editingCategory && String(this.editingCategory.id) === String(id)) {
            this.cancelEditCategory();
          }
          if (this.viewingCategoryDetails && String(this.viewingCategoryDetails.id) === String(id)) {
            this.viewingCategoryDetails = null;
          }
          this.messageService.add({ severity: 'success', summary: 'Success', detail: 'Category deleted successfully!' });
        },
        error: (err: any) => {
          console.error('Error deleting category:', err);
          this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to delete category' });
        }
      });
    }
  }

  loadUnits(): void {
    this.inventoryService.getMeasurementUnits().pipe(takeUntil(this.destroy$)).subscribe({
      next: (units: MeasurementUnit[]) => {
        this.rawUnits = units;
      }
    });
  }

  openUnitModal(): void {
    console.log('openUnitModal: showUnitModal set to true');
    this.showUnitModal = true;
    this.editingUnit = null;
    this.viewingUnitDetails = null;
    this.newUnitName = '';
    this.newUnitCode = '';
    this.newUnitDesc = '';
  }

  closeUnitModal(): void {
    this.showUnitModal = false;
    this.editingUnit = null;
    this.viewingUnitDetails = null;
    this.newUnitName = '';
    this.newUnitCode = '';
    this.newUnitDesc = '';
  }

  startEditUnit(unit: MeasurementUnit): void {
    this.editingUnit = unit;
    this.viewingUnitDetails = null;
    this.newUnitName = unit.name;
    this.newUnitCode = unit.code || '';
    this.newUnitDesc = unit.description || '';
  }

  startViewUnit(unit: MeasurementUnit): void {
    this.viewingUnitDetails = unit;
    this.editingUnit = null;
  }

  closeUnitDetails(): void {
    this.viewingUnitDetails = null;
  }

  cancelEditUnit(): void {
    this.editingUnit = null;
    this.newUnitName = '';
    this.newUnitCode = '';
    this.newUnitDesc = '';
  }

  submitUnit(): void {
    const trimmedName = this.newUnitName.trim();
    if (!trimmedName) {
      this.messageService.add({ severity: 'warn', summary: 'Warning', detail: 'Please enter a unit name' });
      return;
    }

    if (this.editingUnit) {
      // Update Mode
      const isDuplicate = this.rawUnits.some(
        u => u.id !== this.editingUnit?.id && u.name.toLowerCase() === trimmedName.toLowerCase()
      );
      if (isDuplicate) {
        this.messageService.add({ severity: 'warn', summary: 'Warning', detail: 'Another unit already has this name' });
        return;
      }

      this.inventoryService.updateMeasurementUnit(this.editingUnit.unitId || this.editingUnit.id, {
        name: trimmedName,
        code: this.newUnitCode.trim(),
        description: this.newUnitDesc.trim()
      }).pipe(takeUntil(this.destroy$)).subscribe({
        next: (updatedUnits: MeasurementUnit[]) => {
          this.rawUnits = updatedUnits;
          this.cancelEditUnit();
          this.messageService.add({ severity: 'success', summary: 'Success', detail: 'Measurement Unit updated successfully!' });
        },
        error: (err: any) => {
          console.error('Error updating unit:', err);
          this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to update unit' });
        }
      });
    } else {
      // Create Mode
      if (this.rawUnits.some(u => u.name.toLowerCase() === trimmedName.toLowerCase())) {
        this.messageService.add({ severity: 'warn', summary: 'Warning', detail: 'Measurement Unit already exists' });
        return;
      }

      this.inventoryService.createMeasurementUnit({
        name: trimmedName,
        code: this.newUnitCode.trim(),
        description: this.newUnitDesc.trim()
      }).pipe(takeUntil(this.destroy$)).subscribe({
        next: (updatedUnits: MeasurementUnit[]) => {
          this.rawUnits = updatedUnits;
          this.newUnitName = '';
          this.newUnitCode = '';
          this.newUnitDesc = '';
          this.messageService.add({ severity: 'success', summary: 'Success', detail: 'Measurement Unit added successfully!' });
          alert(`Measurement Unit "${trimmedName}" has been created successfully.`);
        },
        error: (err: any) => {
          console.error('Error adding unit:', err);
          this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to add unit' });
        }
      });
    }
  }

  confirmDeleteUnit(id: string | number | undefined, name: string): void {
    if (id === undefined) return;
    if (confirm(`Are you sure you want to delete the unit "${name}"?`)) {
      this.inventoryService.deleteMeasurementUnit(String(id)).pipe(takeUntil(this.destroy$)).subscribe({
        next: (updatedUnits: MeasurementUnit[]) => {
          this.rawUnits = updatedUnits;
          if (this.editingUnit && String(this.editingUnit.id) === String(id)) {
            this.cancelEditUnit();
          }
          if (this.viewingUnitDetails && String(this.viewingUnitDetails.id) === String(id)) {
            this.viewingUnitDetails = null;
          }
          this.messageService.add({ severity: 'success', summary: 'Success', detail: 'Measurement Unit deleted successfully!' });
        },
        error: (err: any) => {
          console.error('Error deleting unit:', err);
          this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to delete unit' });
        }
      });
    }
  }

  loadSuppliers(): void {
    this.inventoryService.getSuppliers().pipe(takeUntil(this.destroy$)).subscribe({
      next: (sups: Supplier[]) => {
        this.rawSuppliers = sups;
      }
    });
  }

  openSupplierModal(): void {
    console.log('openSupplierModal: showSupplierModal set to true');
    this.showSupplierModal = true;
    this.editingSupplier = null;
    this.viewingSupplierDetails = null;
    this.newSupplierName = '';
    this.newSupplierEmail = '';
    this.newSupplierPhone = '';
    this.newSupplierAddress = '';
    this.newSupplierContactPerson = '';
  }

  closeSupplierModal(): void {
    this.showSupplierModal = false;
    this.editingSupplier = null;
    this.viewingSupplierDetails = null;
    this.newSupplierName = '';
    this.newSupplierEmail = '';
    this.newSupplierPhone = '';
    this.newSupplierAddress = '';
    this.newSupplierContactPerson = '';
  }

  startEditSupplier(supplier: Supplier): void {
    this.editingSupplier = supplier;
    this.viewingSupplierDetails = null;
    this.newSupplierName = supplier.name;
    this.newSupplierEmail = supplier.email || '';
    this.newSupplierPhone = supplier.phone || '';
    this.newSupplierAddress = supplier.address || '';
    this.newSupplierContactPerson = supplier.contactPerson || '';
  }

  startViewSupplier(supplier: Supplier): void {
    this.viewingSupplierDetails = supplier;
    this.editingSupplier = null;
  }

  closeSupplierDetails(): void {
    this.viewingSupplierDetails = null;
  }

  cancelEditSupplier(): void {
    this.editingSupplier = null;
    this.newSupplierName = '';
    this.newSupplierEmail = '';
    this.newSupplierPhone = '';
    this.newSupplierAddress = '';
    this.newSupplierContactPerson = '';
  }

  submitSupplier(): void {
    const trimmedName = this.newSupplierName.trim();
    if (!trimmedName) {
      this.messageService.add({ severity: 'warn', summary: 'Warning', detail: 'Please enter a supplier name' });
      return;
    }

    const payload: Partial<Supplier> = {
      name: trimmedName,
      email: this.newSupplierEmail.trim(),
      phone: this.newSupplierPhone.trim(),
      address: this.newSupplierAddress.trim(),
      contactPerson: this.newSupplierContactPerson.trim()
    };

    if (this.editingSupplier) {
      // Update Mode
      const isDuplicate = this.rawSuppliers.some(
        s => s.id !== this.editingSupplier?.id && s.name.toLowerCase() === trimmedName.toLowerCase()
      );
      if (isDuplicate) {
        this.messageService.add({ severity: 'warn', summary: 'Warning', detail: 'Another supplier already has this name' });
        return;
      }

      this.inventoryService.updateSupplier(this.editingSupplier.supplierId || this.editingSupplier.id, payload).pipe(takeUntil(this.destroy$)).subscribe({
        next: (updatedSups: Supplier[]) => {
          this.rawSuppliers = updatedSups;
          this.cancelEditSupplier();
          this.messageService.add({ severity: 'success', summary: 'Success', detail: 'Supplier updated successfully!' });
        },
        error: (err: any) => {
          console.error('Error updating supplier:', err);
          this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to update supplier' });
        }
      });
    } else {
      // Create Mode
      if (this.rawSuppliers.some(s => s.name.toLowerCase() === trimmedName.toLowerCase())) {
        this.messageService.add({ severity: 'warn', summary: 'Warning', detail: 'Supplier already exists' });
        return;
      }

      this.inventoryService.createSupplier(payload).pipe(takeUntil(this.destroy$)).subscribe({
        next: (updatedSups: Supplier[]) => {
          this.rawSuppliers = updatedSups;
          this.closeSupplierModal();
          this.messageService.add({ severity: 'success', summary: 'Success', detail: 'Supplier added successfully!' });
        },
        error: (err: any) => {
          console.error('Error adding supplier:', err);
          this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to add supplier' });
        }
      });
    }
  }

  confirmDeleteSupplier(id: string | number | undefined, name: string): void {
    if (id === undefined) return;
    if (confirm(`Are you sure you want to delete the supplier "${name}"?`)) {
      this.inventoryService.deleteSupplier(String(id)).pipe(takeUntil(this.destroy$)).subscribe({
        next: (updatedSups: Supplier[]) => {
          this.rawSuppliers = updatedSups;
          if (this.editingSupplier && String(this.editingSupplier.id) === String(id)) {
            this.cancelEditSupplier();
          }
          if (this.viewingSupplierDetails && String(this.viewingSupplierDetails.id) === String(id)) {
            this.viewingSupplierDetails = null;
          }
          this.messageService.add({ severity: 'success', summary: 'Success', detail: 'Supplier deleted successfully!' });
        },
        error: (err: any) => {
          console.error('Error deleting supplier:', err);
          this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to delete supplier' });
        }
      });
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadProducts(): void {
    this.isLoading = true;

    this.inventoryService.getProducts(this.filters as any).pipe(takeUntil(this.destroy$)).subscribe({
      next: (response: any) => {
        this.products = response.data;
        this.totalElements = response.total;
        this.totalPages = Math.ceil(response.total / this.filters.size);
        this.calculateStats();
        this.isLoading = false;
      },
      error: (error: any) => {
        console.error('Error loading products:', error);
        this.calculateStats();
        this.isLoading = false;
      }
    });
  }

  private calculateStats(): void {
    const totalValue = this.products.reduce((sum, p) => sum + ((p.unitPrice || p.sellingPrice || 0) * p.stockQuantity), 0);

    this.stats = {
      total: this.products.length,
      active: this.products.filter(p => p.status === 'ACTIVE').length,
      outOfStock: this.products.filter(p => p.status === 'OUT_OF_STOCK').length,
      discontinued: this.products.filter(p => p.status === 'DISCONTINUED').length,
      totalValue: totalValue
    };
  }

  applyFilters(): void {
    this.filters.page = 0;
    this.loadProducts();
  }

  resetFilters(): void {
    this.filters = {
      status: 'ALL',
      category: 'ALL',
      searchTerm: '',
      minPrice: '',
      maxPrice: '',
      page: 0,
      size: 10
    };
    this.loadProducts();
  }

  onPageChange(page: number): void {
    this.filters.page = page;
    this.loadProducts();
  }

  onPageSizeChange(size: number): void {
    this.filters.size = size;
    this.filters.page = 0;
    this.loadProducts();
  }

  toggleSelection(productId: any, event: any): void {
    if (event.target.checked) {
      this.selectedProductIds.push(productId);
    } else {
      this.selectedProductIds = this.selectedProductIds.filter(id => String(id) !== String(productId));
    }
  }

  toggleSelectAll(event: any): void {
    if (event.target.checked) {
      this.selectedProductIds = this.products.map(p => p.productId || String(p.id));
    } else {
      this.selectedProductIds = [];
    }
  }

  isSelected(productId: any): boolean {
    return this.selectedProductIds.includes(productId);
  }

  isAllSelected(): boolean {
    return this.products.length > 0 && this.selectedProductIds.length === this.products.length;
  }

  getStatusBadgeClass(status: string): string {
    const classes: Record<string, string> = {
      'ACTIVE': 'status-active',
      'OUT_OF_STOCK': 'status-out-of-stock',
      'DISCONTINUED': 'status-discontinued'
    };
    return classes[status] || 'status-active';
  }

  getStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      'ACTIVE': 'Active',
      'OUT_OF_STOCK': 'Out of Stock',
      'DISCONTINUED': 'Discontinued'
    };
    return labels[status] || status;
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(amount);
  }

  formatDate(date: any): string {
    if (!date) return '—';
    return new Date(date).toLocaleDateString('en-GB');
  }

  getStockStatusClass(stockQuantity: number): string {
    if (stockQuantity === 0) return 'stock-out';
    if (stockQuantity <= 5) return 'stock-low';
    return 'stock-good';
  }

  getStockStatusLabel(stockQuantity: number): string {
    if (stockQuantity === 0) return 'Out of Stock';
    if (stockQuantity <= 5) return 'Low Stock';
    return 'In Stock';
  }

  getStatusClass(status: string): string {
    return status ? status.toLowerCase().replace(/_/g, '-') : '';
  }

  getCategoryName(product: any): string {
    if (product?.category?.name) return product.category.name;
    const raw = product?.category ?? product?.categoryId;
    if (!raw) return '—';
    if (typeof raw === 'string') {
      // `category` may hold either the category's id or its literal name (legacy data) —
      // resolve it to a name if it matches a known category, otherwise trust it as-is.
      const byId = this.rawCategories.find(c => String(c.id) === String(raw) || c.categoryId === raw);
      return byId?.name || raw;
    }
    return '—';
  }

  navigateToNewProduct(): void {
    const uuid = this.route.snapshot.paramMap.get('uuid');
    if (uuid) {
      this.router.navigate(['/admin/sales/commerce/inventory/products/new', uuid]);
    } else {
      this.router.navigate(['/admin/sals/commerce/inventory/products/new']);
    }
  }

  // Navigate to bulk import page
  navigateToBulkImport(): void {
    const uuid = this.route.snapshot.paramMap.get('uuid');
    if (uuid) {
      this.router.navigate(['/admin/sales/commerce/inventory/products', 'bulk-import', uuid]);
    } else {
      this.router.navigate(['/admin/sales/commerce/inventory/products', 'bulk-import']);
    }
  }


  viewProduct(productId: string): void {
    const uuid = this.route.snapshot.paramMap.get('uuid');
    if (uuid) {
      this.router.navigate(['/admin/sales/commerce/inventory/products', productId, uuid]);
    } else {
      this.router.navigate(['/admin/sales/commerce/inventory/products', productId]);
    }
  }

  editProduct(productId: string): void {
    const uuid = this.route.snapshot.paramMap.get('uuid');
    if (uuid) {
      this.router.navigate(['/admin/sales/commerce/inventory/products', productId, 'edit', uuid]);
    } else {
      this.router.navigate(['/admin/sales/commerce/inventory/products', productId, 'edit']);
    }
  }

  deleteProduct(product: Product): void {
    this.pendingDeleteProductObj = product;
    this.pendingDeleteProductName = product.name;
    this.showDeleteModal = true;
  }

  confirmDeleteProduct(): void {
    if (!this.pendingDeleteProductObj) return;
    const productObj = this.pendingDeleteProductObj;
    this.inventoryService.deleteProduct(productObj.id).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.loadProducts();
        this.showDeleteModal = false;
        this.pendingDeleteProductObj = null;
        this.messageService.add({ severity: 'success', summary: 'Success', detail: `Product ${productObj.name} deleted successfully` });
      },
      error: (error: any) => {
        console.error('Error deleting product:', error);
        this.showDeleteModal = false;
        this.pendingDeleteProductObj = null;
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to delete product. Please try again.' });
      }
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

}

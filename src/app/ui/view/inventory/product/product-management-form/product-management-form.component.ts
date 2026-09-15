import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, FormArray, Validators, AbstractControl, ValidatorFn } from '@angular/forms';
import { Observable, Subject, forkJoin, of } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { catchError } from 'rxjs/operators';
import { InventoryService } from '../../../../service/inventory/inventory.service';
import { Product, MeasurementUnit, Supplier, Category } from '../../../../domain/inventory/inventory.dto';
import { BackButtonComponent } from '../../../../shared-component/view/back-button/back-button.component';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';


export function futureDateValidator(): ValidatorFn {
  return (control: AbstractControl): { [key: string]: any } | null => {
    if (!control.value) {
      return null;
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const controlDate = new Date(control.value);
    controlDate.setHours(0, 0, 0, 0);
    return controlDate < today ? { 'pastDate': true } : null;
  };
}

export function pastDateValidator(): ValidatorFn {
  return (control: AbstractControl): { [key: string]: any } | null => {
    if (!control.value) {
      return null;
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const controlDate = new Date(control.value);
    controlDate.setHours(0, 0, 0, 0);
    return controlDate > today ? { 'futureDate': true } : null;
  };
}

const MOCK_CATEGORIES: Category[] = [
  { id: 1, categoryId: 'cat-1', name: 'Electronics', description: 'Gadgets, appliances, laptops, phones', createdAt: new Date(), updatedAt: new Date() },
  { id: 2, categoryId: 'cat-2', name: 'Furniture', description: 'Chairs, desks, sofas, tables', createdAt: new Date(), updatedAt: new Date() },
  { id: 3, categoryId: 'cat-3', name: 'Office Supplies', description: 'Papers, pens, staplers', createdAt: new Date(), updatedAt: new Date() },
  { id: 4, categoryId: 'cat-4', name: 'Apparel', description: 'Clothing, uniforms, shoes', createdAt: new Date(), updatedAt: new Date() },
  { id: 5, categoryId: 'cat-5', name: 'Hardware', description: 'Tools, building supplies, equipment', createdAt: new Date(), updatedAt: new Date() }
];

const MOCK_UNITS: MeasurementUnit[] = [
  // `unitId` carries the matching Product.unitOfMeasure code — id is now numeric per the
  // /measurement-units API contract, so it can no longer double as that code the way it used to.
  { id: 1, unitId: 'EACH', name: 'pcs', code: 'PCS', description: 'Pieces', createdAt: new Date(), updatedAt: new Date() },
  { id: 2, unitId: 'KG', name: 'kg', code: 'KG', description: 'Kilograms', createdAt: new Date(), updatedAt: new Date() },
  { id: 3, unitId: 'BOX', name: 'box', code: 'BOX', description: 'Boxes', createdAt: new Date(), updatedAt: new Date() },
  { id: 4, unitId: 'EACH', name: 'pack', code: 'PACK', description: 'Packs', createdAt: new Date(), updatedAt: new Date() },
  { id: 5, unitId: 'METER', name: 'm', code: 'METER', description: 'Meters', createdAt: new Date(), updatedAt: new Date() }
];

const MOCK_SUPPLIERS: Supplier[] = [
  { id: 1, name: 'Alibaba Group', contactPerson: 'Jack Ma', email: 'sales@alibaba.com', phone: '123456789', address: 'Hangzhou, China', createdAt: new Date(), updatedAt: new Date() },
  { id: 2, name: 'Jumia Business', contactPerson: 'Amina Bello', email: 'amina@jumia.com', phone: '987654321', address: 'Lagos, Nigeria', createdAt: new Date(), updatedAt: new Date() },
  { id: 3, name: 'Konga Wholesales', contactPerson: 'Obinna Ike', email: 'obinna@konga.com', phone: '555666777', address: 'Lagos, Nigeria', createdAt: new Date(), updatedAt: new Date() },
  { id: 4, name: 'Global Logistics Partners', contactPerson: 'John Smith', email: 'john@glp.com', phone: '888999000', address: 'New York, USA', createdAt: new Date(), updatedAt: new Date() }
];

@Component({
  selector: 'app-product-management-form',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    ReactiveFormsModule,
    BackButtonComponent,
    ToastModule
  ],
  providers: [MessageService],
  templateUrl: './product-management-form.component.html',
  styleUrl: './product-management-form.component.scss'
})
export class ProductManagementFormComponent implements OnInit, OnDestroy {

  productForm: FormGroup;
  get todayDateString(): string {
    return new Date().toISOString().split('T')[0];
  }
  isEditMode = false;
  productId: string = '';
  isLoading = false;
  isSubmitting = false;
  error: string | null = null;
  variantModalForm!: FormGroup;

  // Mock data
  categories: string[] = [];
  rawCategories: Category[] = [];
  taxOptions: string[] = ['VAT 7.5%', 'VAT 5%', 'No Tax', '0%'];
  discountOptions: string[] = ['No Discount', '5%', '10%', '15%', '20%', '25%', '50%'];
  measurementUnits: MeasurementUnit[] = [];
  suppliers: Supplier[] = [];

  // "+ Add X" modals for Category / Measurement Unit / Supplier — same pattern as the
  // Request for Quotation form's "+ Add Category" option.
  showAddCategoryModal = false;
  newCategoryName = '';
  newCategoryDesc = '';

  showAddUnitModal = false;
  newUnitName = '';

  showAddSupplierModal = false;
  newSupplierName = '';

  // Product variants
  variants: any[] = [];
  showVariantModal = false;
  currentVariantIndex: number | null = null;

  // UI State
  showDeleteConfirm = false;
  showAdditionalInfo = false;
  showStockMovement = true;
  showComboOptions = false;

  // For file upload
  attachmentFileName: string = '';

  images: string[] = [];
  private originalImages: string[] = [];
  demoImages = [
    { name: 'Laptop', url: 'https://images.unsplash.com/photo-1496181130204-755241544e35?auto=format&fit=crop&w=400&q=80' },
    { name: 'Office Chair', url: 'https://images.unsplash.com/photo-1505797149-43b0069ec26b?auto=format&fit=crop&w=400&q=80' },
    { name: 'Standing Desk', url: 'https://images.unsplash.com/photo-1518455027359-f3f8164ba6bd?auto=format&fit=crop&w=400&q=80' },
    { name: 'Printer', url: 'https://images.unsplash.com/photo-1612815154858-60aa4c59eaa6?auto=format&fit=crop&w=400&q=80' },
    { name: 'Tablet', url: 'https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?auto=format&fit=crop&w=400&q=80' }
  ];

  private destroy$ = new Subject<void>();

  constructor(
    private messageService: MessageService,
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private inventoryService: InventoryService
  ) {
    this.productForm = this.createForm();
    this.initVariantModalForm();
  }

  initVariantModalForm(): void {
    this.variantModalForm = this.fb.group({
      name: ['', Validators.required],
      sku: [''],
      price: [0, [Validators.required, Validators.min(0)]],
      quantity: [0, [Validators.required, Validators.min(0)]],
      color: [''],
      size: [''],
      material: [''],
      model: [''],
      year: ['']
    });
  }

  ngOnInit(): void {
    this.productId = this.route.snapshot.paramMap.get('id') || '';
    this.isEditMode = !!this.productId;

    if (this.isEditMode) {
      forkJoin({
        cats: this.inventoryService.getCategories().pipe(catchError(() => of([]))),
        units: this.inventoryService.getMeasurementUnits().pipe(catchError(() => of([]))),
        sups: this.inventoryService.getSuppliers().pipe(catchError(() => of([])))
      }).subscribe(({ cats, units, sups }) => {
        this.rawCategories = cats.length ? cats : MOCK_CATEGORIES;
        this.categories = this.rawCategories.map(c => c.name);
        this.measurementUnits = units.length ? units : MOCK_UNITS;
        this.suppliers = sups.length ? sups : MOCK_SUPPLIERS;
        this.loadProduct();
      });
    } else {
      this.loadCategories();
      this.loadUnits();
      this.loadSuppliers();
    }
  }

  loadCategories(): void {
    this.inventoryService.getCategories().subscribe({
      next: (cats) => {
        this.rawCategories = cats.length ? cats : MOCK_CATEGORIES;
        this.categories = this.rawCategories.map(c => c.name);
      },
      error: () => {
        this.rawCategories = MOCK_CATEGORIES;
        this.categories = MOCK_CATEGORIES.map(c => c.name);
      }
    });
  }

  loadUnits(): void {
    this.inventoryService.getMeasurementUnits().subscribe({
      next: (units) => {
        this.measurementUnits = units.length ? units : MOCK_UNITS;
      },
      error: () => {
        this.measurementUnits = MOCK_UNITS;
      }
    });
  }

  loadSuppliers(): void {
    this.inventoryService.getSuppliers().subscribe({
      next: (sups) => {
        this.suppliers = sups.length ? sups : MOCK_SUPPLIERS;
      },
      error: () => {
        this.suppliers = MOCK_SUPPLIERS;
      }
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  createForm(): FormGroup {
    return this.fb.group({
      // General Information
      name: ['', [Validators.required, Validators.minLength(2)]],
      description: ['', [Validators.required, Validators.minLength(10)]],
      category: ['', Validators.required],

      // Identifiers
      partNumber: [''],
      sku: [''],
      code: [''],
      measurementUnit: ['pcs'],

      // Pricing & Inventory
      costPrice: [null, [Validators.required, Validators.min(0.01)]],
      sellingPrice: [null, [Validators.required, Validators.min(0.01)]],
      quantity: [null, [Validators.required, Validators.min(0)]],
      expiryDate: ['', [futureDateValidator()]],
      discount: ['No Discount'],
      taxes: ['VAT 7.5%'],
      supplier: [''],

      // Stock Movement
      movementDate: [new Date().toISOString().split('T')[0], [pastDateValidator()]],
      movementQuantity: [1, [Validators.min(1)]],
      movementPurchasePrice: [0],
      movementTax: [''],

      // Additional
      reference: [''],
      selectedSupplier: [''],
      sellingPriceDisplay: ['N/A'],
      discountDisplay: ['Select discount'],

      // Combo
      isComboProduct: [false],

      // Variants
      variants: this.fb.array([]),

      // Online Store
      availableOnline: [false],

      // Reorder
      reorderThreshold: [0],
      weight: [0]
    });
  }

  get variantsArray(): FormArray {
    return this.productForm.get('variants') as FormArray;
  }

  loadProduct(): void {
    this.isLoading = true;
    this.inventoryService.getProduct(this.productId).subscribe({
      next: (product: any) => {
        if (product) {
          const categoryName = this.rawCategories.find(c => c.id === product.category)?.name || '';
          const unitName = this.measurementUnits.find(u => u.id === product.unitOfMeasure)?.name || 'pcs';
          const supplierName = this.suppliers.find(s => s.id === (product.supplierIds && product.supplierIds[0]))?.name || '';

          this.productForm.patchValue({
            name: product.name,
            description: product.description,
            category: categoryName,
            sku: product.sku,
            costPrice: product.costPrice,
            sellingPrice: product.sellingPrice,
            quantity: product.stockQuantity,
            measurementUnit: unitName,
            supplier: supplierName,
            selectedSupplier: supplierName,
            isComboProduct: product.isComboProduct || false,
            weight: product.weight || 0
          });
          this.images = (product.images || []).filter((img: string) => !img.includes('localhost') && !img.includes('127.0.0.1'));
          this.originalImages = [...this.images];
          this.showComboOptions = product.isComboProduct || false;

          this.variantsArray.clear();
          if (product.variants && Array.isArray(product.variants)) {
            product.variants.forEach((v: any) => {
              const variantGroup = this.fb.group({
                name: [v.name, Validators.required],
                sku: [v.sku],
                price: [v.price, [Validators.required, Validators.min(0)]],
                quantity: [v.quantity, [Validators.required, Validators.min(0)]],
                attributes: this.fb.group({
                  color: [v.attributes?.color || ''],
                  size: [v.attributes?.size || ''],
                  material: [v.attributes?.material || '']
                })
              });
              this.variantsArray.push(variantGroup);
            });
          }
        }
        this.isLoading = false;
      },
      error: (error: any) => {
        console.error('Error loading product:', error);
        this.isLoading = false;
        this.error = 'Failed to load product. Please try again.';
        this.messageService.add({ severity: 'error', summary: 'Error', detail: this.error });
        this.goBack();
      }
    });
  }

  onSubmit(): void {
    this.error = null;
    if (this.productForm.invalid) {
      this.productForm.markAllAsTouched();
      const invalidControls: string[] = [];
      const controls = this.productForm.controls;
      for (const name in controls) {
        if (controls[name].invalid) {
          invalidControls.push(name);
        }
      }
      console.warn('Form is invalid. Invalid controls:', invalidControls);
      return;
    }

    this.isSubmitting = true;
    const formData = this.productForm.getRawValue();

    const foundCategory = this.rawCategories.find(c => c.name === formData.category);
    const foundUnit = this.measurementUnits.find(u => u.name === (formData.measurementUnit || 'pcs'));
    const supplierName = formData.supplier || formData.selectedSupplier || '';
    const foundSupplier = this.suppliers.find(s => s.name === supplierName);

    const productData: Partial<Product> = {
      name: formData.name,
      description: formData.description,
      sku: formData.sku || `SKU-${Date.now()}`,
      sellingPrice: formData.sellingPrice,
      costPrice: formData.costPrice,
      stockQuantity: formData.quantity,
      images: this.images,
      category: foundCategory ? String(foundCategory.id) : undefined,
      unitOfMeasure: (foundUnit?.unitId || 'EACH') as 'EACH' | 'BOX' | 'KG' | 'LITER' | 'METER',
      supplierIds: foundSupplier ? [String(foundSupplier.id)] : [],
      status: (formData.quantity ?? 0) > 0 ? 'ACTIVE' as any : 'OUT_OF_STOCK' as any,
      isComboProduct: formData.isComboProduct || false,
      weight: Number(formData.weight) || 0
    };

    const action = this.isEditMode
      ? this.inventoryService.updateProduct(this.productId, productData)
      : this.inventoryService.createProduct(productData);

    action.pipe(
      switchMap(savedProduct => this.persistNewImages(savedProduct))
    ).subscribe({
      next: () => {
        this.isSubmitting = false;
        this.messageService.add({ severity: 'success', summary: 'Success', detail: `Product ${this.isEditMode ? 'updated' : 'created'} successfully!` });
        // After editing, land on the product's details page so the change is visible immediately.
        // After creating, there's no existing detail context to return to, so keep the prior behavior.
        if (this.isEditMode) {
          this.router.navigate(['/admin/sales/commerce/inventory/products', this.productId]);
        } else {
          this.goBack();
        }
      },
      error: (error: any) => {
        console.error('Error saving product:', error);
        this.isSubmitting = false;
        this.error = String(error?.message || 'Failed to save product. Please try again.');
        this.messageService.add({ severity: 'error', summary: 'Error', detail: this.error });
      }
    });
  }

  private persistNewImages(product: Product): Observable<Product> {
    const newImages = this.images.filter(image => !this.originalImages.includes(image));
    if (!newImages.length || product.id == null) {
      return of(product);
    }

    return forkJoin(newImages.map((image, index) =>
      this.inventoryService.addProductImage(product.id, image, this.originalImages.length + index)
    )).pipe(map(() => ({ ...product, images: [...this.images] })));
  }

  extractTaxRate(tax: string): number {
    const match = tax.match(/(\d+\.?\d*)%/);
    return match ? parseFloat(match[1]) : 7.5;
  }

  markAllAsTouched(): void {
    Object.values(this.productForm.controls).forEach(control => {
      control.markAsTouched();
    });
  }

  // Variant Management
  openVariantModal(): void {
    this.currentVariantIndex = null;
    this.variantModalForm.reset({
      name: '',
      sku: '',
      price: 0,
      quantity: 0,
      color: '',
      size: '',
      material: '',
      model: '',
      year: ''
    });
    this.showVariantModal = true;
  }

  openEditVariantModal(index: number): void {
    this.currentVariantIndex = index;
    const variant = this.variantsArray.at(index);
    this.variantModalForm.patchValue({
      name: variant.get('name')?.value || '',
      sku: variant.get('sku')?.value || '',
      price: variant.get('price')?.value || 0,
      quantity: variant.get('quantity')?.value || 0,
      color: variant.get('attributes.color')?.value || '',
      size: variant.get('attributes.size')?.value || '',
      material: variant.get('attributes.material')?.value || '',
      model: variant.get('attributes.model')?.value || '',
      year: variant.get('attributes.year')?.value || ''
    });
    this.showVariantModal = true;
  }

  saveVariant(): void {
    if (this.variantModalForm.invalid) {
      this.variantModalForm.markAllAsTouched();
      return;
    }

    const formValues = this.variantModalForm.getRawValue();
    const variantData = {
      name: formValues.name.trim(),
      sku: formValues.sku.trim() || `VAR-${Date.now().toString().slice(-6)}`,
      price: Number(formValues.price) || 0,
      quantity: Number(formValues.quantity) || 0,
      attributes: {
        color: formValues.color ? formValues.color.trim() : '',
        size: formValues.size ? formValues.size.trim() : '',
        material: formValues.material ? formValues.material.trim() : '',
        model: formValues.model ? formValues.model.trim() : '',
        year: formValues.year ? String(formValues.year).trim() : ''
      }
    };

    if (this.currentVariantIndex !== null && this.currentVariantIndex < this.variantsArray.length) {
      // Editing an existing variant
      const variantGroup = this.variantsArray.at(this.currentVariantIndex);
      variantGroup.patchValue(variantData);
    } else {
      // Creating a new variant
      const variantGroup = this.fb.group({
        name: [variantData.name, Validators.required],
        sku: [variantData.sku],
        price: [variantData.price, [Validators.required, Validators.min(0)]],
        quantity: [variantData.quantity, [Validators.required, Validators.min(0)]],
        attributes: this.fb.group({
          color: [variantData.attributes.color],
          size: [variantData.attributes.size],
          material: [variantData.attributes.material],
          model: [variantData.attributes.model],
          year: [variantData.attributes.year]
        })
      });
      this.variantsArray.push(variantGroup);
    }

    // Auto-update total stock quantity if variants are present and main stock is 0
    const totalVariantQty = this.variantsArray.controls.reduce((sum, ctrl) => sum + (Number(ctrl.get('quantity')?.value) || 0), 0);
    if (totalVariantQty > 0 && (this.productForm.get('quantity')?.value === 0 || !this.productForm.get('quantity')?.value)) {
      this.productForm.patchValue({ quantity: totalVariantQty });
    }

    this.showVariantModal = false;
    this.currentVariantIndex = null;
  }

  removeVariant(index: number): void {
    this.variantsArray.removeAt(index);
  }

  // File Upload (legacy filename capture)
  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.attachmentFileName = input.files[0].name;
    }
  }

  // Image selection handling for previews
  onImageSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      for (let i = 0; i < input.files.length; i++) {
        const file = input.files.item(i);
        if (file) {
          const reader = new FileReader();
          reader.onload = (e) => {
            const result = e.target?.result as string;
            if (result) {
              this.images.push(result);
            }
          };
          reader.readAsDataURL(file);
        }
      }
    }
  }

  // Add image from URL input
  addImageUrl(url: string): void {
    const trimmed = url?.trim();
    if (trimmed) {
      if (trimmed.includes('localhost') || trimmed.includes('127.0.0.1')) {
        this.messageService.add({ severity: 'warn', summary: 'Warning', detail: 'Localhost image URLs are not allowed.' });
        return;
      }
      this.images.push(trimmed);
    }
  }

  // Remove image from preview list
  removeImage(index: number): void {
    if (index >= 0 && index < this.images.length) {
      this.images.splice(index, 1);
    }
  }

  // Navigation
  goBack(): void {
    const uuid = this.route.snapshot.paramMap.get('uuid');
    if (uuid) {
      this.router.navigate(['/admin/sales/commerce/inventory', uuid]);
    } else {
      this.router.navigate(['/admin/sales/commerce/inventory']);
    }
  }

  // Form validation helpers
  isFieldInvalid(fieldName: string): boolean {
    const control = this.productForm.get(fieldName);
    return !!control && control.invalid && (control.dirty || control.touched);
  }

  getFieldError(fieldName: string): string {
    const control = this.productForm.get(fieldName);
    if (!control || !control.errors) return '';

    if (control.errors['required']) return 'This field is required';
    if (control.errors['minlength']) return `Minimum ${control.errors['minlength'].requiredLength} characters required`;
    if (control.errors['min']) return `Value must be at least ${control.errors['min'].min}`;
    if (control.errors['max']) return `Value cannot exceed ${control.errors['max'].max}`;
    if (control.errors['pastDate']) return 'Date cannot be in the past';
    if (control.errors['futureDate']) return 'Date cannot be in the future';

    return 'Invalid value';
  }

  // Helper: Generate SKU
  generateSku(): void {
    const name = this.productForm.get('name')?.value || 'PROD';
    const timestamp = Date.now().toString().slice(-6);
    const sku = `${name.substring(0, 3).toUpperCase()}-${timestamp}`;
    this.productForm.patchValue({ sku });
  }

  // Helper: Auto-fill from code (UPC/Barcode)
  autoFillFromCode(): void {
    const code = this.productForm.get('code')?.value;
    if (code && code.length >= 12) {
      // Simulate API call to fetch product info
      this.isLoading = true;
      setTimeout(() => {
        this.productForm.patchValue({
          name: 'Auto-filled Product',
          description: 'Product details retrieved from online database',
          category: 'Electronics',
          measurementUnit: 'Each'
        });
        this.isLoading = false;
        this.messageService.add({ severity: 'info', summary: 'Notice', detail: 'Product information auto-filled from code!' });
      }, 1000);
    }
  }

  // ============================================================
  // CATEGORY — "+ Add Category"
  // ============================================================

  onCategoryChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    if (value === '__add_category__') {
      this.productForm.get('category')?.setValue('', { emitEvent: false });
      this.openAddCategoryModal();
    }
  }

  openAddCategoryModal(): void {
    this.newCategoryName = '';
    this.newCategoryDesc = '';
    this.showAddCategoryModal = true;
  }

  closeAddCategoryModal(): void {
    this.showAddCategoryModal = false;
  }

  saveCustomCategory(): void {
    const name = this.newCategoryName.trim();
    if (!name) return;

    if (this.rawCategories.some(c => c.name.toLowerCase() === name.toLowerCase())) {
      this.messageService.add({ severity: 'warn', summary: 'Warning', detail: `Category "${name}" already exists.` });
      return;
    }

    this.inventoryService.createCategory({ name, description: this.newCategoryDesc.trim() }).subscribe({
      next: (updatedCats: Category[]) => {
        this.rawCategories = updatedCats;
        this.categories = updatedCats.map(c => c.name);
        this.productForm.patchValue({ category: name });
        this.closeAddCategoryModal();
        this.messageService.add({ severity: 'success', summary: 'Success', detail: `Category "${name}" added successfully.` });
        alert(`Category "${name}" has been created successfully.`);
      },
      error: (err: any) => {
        console.error('Error adding category:', err);
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to add category' });
      }
    });
  }

  // ============================================================
  // MEASUREMENT UNIT — "+ Add Unit"
  // ============================================================

  onUnitChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    if (value === '__add_unit__') {
      this.productForm.get('measurementUnit')?.setValue('', { emitEvent: false });
      this.openAddUnitModal();
    }
  }

  openAddUnitModal(): void {
    this.newUnitName = '';
    this.showAddUnitModal = true;
  }

  closeAddUnitModal(): void {
    this.showAddUnitModal = false;
  }

  saveCustomUnit(): void {
    const name = this.newUnitName.trim();
    if (!name) return;

    if (this.measurementUnits.some(u => u.name.toLowerCase() === name.toLowerCase())) {
      this.messageService.add({ severity: 'warn', summary: 'Warning', detail: `Unit "${name}" already exists.` });
      return;
    }

    const code = name.replace(/\s+/g, '').toUpperCase();
    this.inventoryService.createMeasurementUnit({ name, code }).subscribe({
      next: (updatedUnits: MeasurementUnit[]) => {
        this.measurementUnits = updatedUnits;
        this.productForm.patchValue({ measurementUnit: name });
        this.closeAddUnitModal();
        this.messageService.add({ severity: 'success', summary: 'Success', detail: `Unit "${name}" added successfully.` });
        alert(`Measurement Unit "${name}" has been created successfully.`);
      },
      error: (err: any) => {
        console.error('Error adding unit:', err);
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to add unit' });
      }
    });
  }

  // ============================================================
  // SUPPLIER — "+ Add Supplier"
  // ============================================================

  onSupplierChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    if (value === '__add_supplier__') {
      this.productForm.get('supplier')?.setValue('', { emitEvent: false });
      this.openAddSupplierModal();
    }
  }

  openAddSupplierModal(): void {
    this.newSupplierName = '';
    this.showAddSupplierModal = true;
  }

  closeAddSupplierModal(): void {
    this.showAddSupplierModal = false;
  }

  saveCustomSupplier(): void {
    const trimmed = this.newSupplierName.trim();
    if (!trimmed) return;

    if (this.suppliers.some(s => s.name.toLowerCase() === trimmed.toLowerCase())) {
      this.messageService.add({ severity: 'warn', summary: 'Warning', detail: `Supplier "${trimmed}" already exists.` });
      return;
    }
    this.inventoryService.createSupplier({ name: trimmed }).subscribe({
      next: (updatedSups: Supplier[]) => {
        this.suppliers = updatedSups;
        this.productForm.patchValue({
          supplier: trimmed,
          selectedSupplier: trimmed
        });
        this.closeAddSupplierModal();
        this.messageService.add({ severity: 'success', summary: 'Success', detail: `Supplier "${trimmed}" added successfully.` });
      },
      error: (err: any) => {
        console.error('Error adding supplier:', err);
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to add supplier' });
      }
    });
  }
}
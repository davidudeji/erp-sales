import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, FormArray, Validators, AbstractControl, ValidatorFn } from '@angular/forms';
import { Subject, forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { SalesService } from '../../../../service/sales/sales.service';
import { Product, ProductVariant, MeasurementUnit, Supplier, Category } from '../../../../domain/sales/sales.dto';
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

@Component({
  selector: 'app-product-service-catalog-form',
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
  templateUrl: './product-service-catalog-form.component.html',
  styleUrls: ['./product-service-catalog-form.component.scss']
})
export class ProductServiceCatalogFormComponent implements OnInit, OnDestroy {
  
  productForm: FormGroup;
  get todayDateString(): string {
    return new Date().toISOString().split('T')[0];
  }
  isEditMode = false;
  productId: string = '';
  isLoading = false;
  isSubmitting = false;
  variantModalForm!: FormGroup;
  
  // Mock data
  categories: string[] = [];
  rawCategories: Category[] = [];
  taxOptions: string[] = ['VAT 7.5%', 'VAT 5%', 'No Tax', '0%'];
  discountOptions: string[] = ['No Discount', '5%', '10%', '15%', '20%', '25%', '50%'];
  measurementUnits: MeasurementUnit[] = [];
  suppliers: Supplier[] = [];
  
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
    private salesService: SalesService
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
        cats: this.salesService.getCategories().pipe(catchError(() => of([]))),
        units: this.salesService.getMeasurementUnits().pipe(catchError(() => of([]))),
        sups: this.salesService.getSuppliers().pipe(catchError(() => of([])))
      }).subscribe(({ cats, units, sups }) => {
        this.rawCategories = cats;
        this.categories = cats.map(c => c.name);
        this.measurementUnits = units;
        this.suppliers = sups;
        this.loadProduct();
      });
    } else {
      this.loadCategories();
      this.loadUnits();
      this.loadSuppliers();
    }
  }

  loadCategories(): void {
    this.salesService.getCategories().subscribe({
      next: (cats) => {
        this.rawCategories = cats;
        this.categories = cats.map(c => c.name);
      }
    });
  }

  loadUnits(): void {
    this.salesService.getMeasurementUnits().subscribe({
      next: (units) => {
        this.measurementUnits = units;
      }
    });
  }

  loadSuppliers(): void {
    this.salesService.getSuppliers().subscribe({
      next: (sups) => {
        this.suppliers = sups;
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
      measurementUnit: ['Each'],
      
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
    this.salesService.getProductById(this.productId).subscribe({
      next: (product: any) => {
        if (product) {
          const categoryName = this.rawCategories.find(c => c.id === product.categoryId)?.name || '';
          const unitName = this.measurementUnits.find(u => u.id === product.measurementUnitId)?.name || 'Each';
          const supplierName = this.suppliers.find(s => s.id === product.supplierId)?.name || '';

          this.productForm.patchValue({
            name: product.name,
            description: product.description,
            category: categoryName,
            sku: product.sku,
            costPrice: product.costPrice,
            sellingPrice: product.unitPrice,
            quantity: product.stockQuantity,
            measurementUnit: unitName,
            supplier: supplierName,
            selectedSupplier: supplierName,
            isComboProduct: product.isComboProduct || false
          });
          this.images = product.images || [];
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
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to load product. Please try again.' });
        this.goBack();
      }
    });
  }

  onSubmit(): void {
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
    const foundUnit = this.measurementUnits.find(u => u.name === (formData.measurementUnit || 'Each'));
    const supplierName = formData.supplier || formData.selectedSupplier || '';
    const foundSupplier = this.suppliers.find(s => s.name === supplierName);

    const productData: Partial<Product> = {
      name: formData.name,
      description: formData.description,
      sku: formData.sku || `SKU-${Date.now()}`,
      unitPrice: formData.sellingPrice,
      costPrice: formData.costPrice,
      stockQuantity: formData.quantity,
      categoryId: foundCategory?.id ?? undefined,
      measurementUnitId: foundUnit?.id ?? undefined,
      supplierId: foundSupplier?.id ?? undefined,
      taxRate: this.extractTaxRate(formData.taxes),
      currency: 'NGN',
      status: (formData.quantity ?? 0) > 0 ? 'ACTIVE' as any : 'OUT_OF_STOCK' as any,
      isComboProduct: formData.isComboProduct || false
    };

    const action = this.isEditMode
      ? this.salesService.updateProduct(this.productId, productData)
      : this.salesService.createProduct(productData);

    action.subscribe({
      next: () => {
        this.isSubmitting = false;
        this.messageService.add({ severity: 'success', summary: 'Success', detail: `Product ${this.isEditMode ? 'updated' : 'created'} successfully!` });
        this.goBack();
      },
      error: (error: any) => {
        console.error('Error saving product:', error);
        this.isSubmitting = false;
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to save product. Please try again.' });
      }
    });
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

  // File Upload
  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.attachmentFileName = input.files[0].name;
    }
  }

  // Navigation
  goBack(): void {
    const uuid = this.route.snapshot.paramMap.get('uuid');
    if (uuid) {
      this.router.navigate(['/sales-hub', uuid]);
    } else {
      this.router.navigate(['/sales-hub']);
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

  addSupplier(): void {
    const newSupplier = prompt('Enter new supplier name:');
    if (newSupplier && newSupplier.trim()) {
      const trimmed = newSupplier.trim();
      if (this.suppliers.some(s => s.name.toLowerCase() === trimmed.toLowerCase())) {
        this.messageService.add({ severity: 'warn', summary: 'Warning', detail: `Supplier "${trimmed}" already exists.` });
        return;
      }
      this.salesService.createSupplier({ name: trimmed }).subscribe({
        next: (updatedSups) => {
          this.suppliers = updatedSups;
          this.productForm.patchValue({
            supplier: trimmed,
            selectedSupplier: trimmed
          });
          this.messageService.add({ severity: 'success', summary: 'Success', detail: `Supplier "${trimmed}" added successfully.` });
        },
        error: (err) => {
          console.error('Error adding supplier:', err);
          this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to add supplier' });
        }
      });
    }
  }

  onImageSelected(event: any): void {
    const files = event.target.files;
    if (files) {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const reader = new FileReader();
        reader.onload = (e: any) => {
          this.images.push(e.target.result);
        };
        reader.readAsDataURL(file);
      }
    }
  }

  addImageUrl(url: string): void {
    const trimmed = url ? url.trim() : '';
    if (trimmed && !this.images.includes(trimmed)) {
      this.images.push(trimmed);
    }
  }

  removeImage(index: number): void {
    this.images.splice(index, 1);
  }
}
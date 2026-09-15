import { Component, OnInit, OnDestroy, Input, Output, EventEmitter, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators, FormArray, AbstractControl, ValidatorFn } from '@angular/forms';
import { Router, RouterModule, ActivatedRoute } from '@angular/router';
import { Subject, takeUntil, forkJoin } from 'rxjs';
import { SalesService } from '../../../../service/sales/sales.service';
import { PdfGenerationService } from '../../../../service/procurement/pdf-generation.service';
import { SalesEmailService } from '../../../../service/sales/sales-email.service';
import { Customer, Product, Quote, QuoteStatus, QuoteItem, CustomerBankDetails, QuoteAttachments, SendSalesEmailRequest, SalesEmailAttachment, MerchantInfo } from '../../../../domain/sales/sales.dto';
import { toDateInputValue, formatApiDate } from '../../../../service/sales/date.util';
import { BackButtonComponent } from '../../../../shared-component/view/back-button/back-button.component';
import { TemplateTypesComponent, QuoteTemplate } from '../../template-types/template-types.component';
import { lastValueFrom } from 'rxjs';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { CompanyProfileService } from '../../../../shared-component/service/company-profile/company-profile.service';

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

@Component({
  selector: 'app-quote-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    RouterModule,
    BackButtonComponent,
    TemplateTypesComponent,
    ToastModule
  ],
  providers: [MessageService],
  templateUrl: './quote-form.component.html',
  styleUrls: ['./quote-form.component.scss']
})
export class QuoteFormComponent implements OnInit, OnDestroy {
  @Input() editId?: string;
  @Input() customerId?: string;
  @Input() duplicateId?: string;

  // Custom modal variables
  showDiscountModal = false;
  showChargesModal = false;
  modalDiscountAmount = 0;
  modalDiscountType: 'PERCENTAGE' | 'FIXED' = 'FIXED';
  
  // Additional charges breakdown
  additionalChargeItems: { id?: number; label: string; amount: number }[] = [];
  modalChargesList: { id?: number; label: string; amount: number }[] = [];
  newChargeLabel = '';
  newChargeAmount: number | null = null;
  @Output() saved = new EventEmitter<void>();
  @Output() cancelled = new EventEmitter<void>();
  
  quoteForm: FormGroup;
  isSubmitting = false;
  isLoading = false;
  isEditMode = false;
  quoteId: string = '';
  generatedQuoteNumber: string = '';
  productId: string = '';
  
  // ============ WIZARD STATE ============
  currentStep: 1 | 2 | 3 = 1;
  totalSteps = 3;
  
  // Data
  customers: Customer[] = [];
  products: Product[] = [];
  filteredProducts: Product[] = [];
  
  // Categories
  categories: string[] = [];
  selectedCategoryForIndex: { [key: number]: string } = {};
  
  // UI State
  showNewCustomerModal = false;
  isSavingCustomer = false;
  showProductModal = false;
  searchProductTerm = '';
  currentItemIndex = 0;

  // Inline product creation
  showNewProductModal = false;
  newProductTargetIndex = 0;
  isSavingProduct = false;
  newProductError = '';
  newProduct = { name: '', description: '', unitPrice: 0, taxRate: 0 };

  // Billed By (Quotation From) editable data — persisted via the merchant-info endpoint.
  showBilledByModal = false;
  isSavingBilledBy = false;
  /** Set once we know a merchant-info record exists, so Save updates it instead of creating a new one. */
  merchantInfoId: number | null = null;
  billedBy = {
    name: '',
    email: '',
    phone: '',
    address: '',
    bankName: '',
    accountName: '',
    accountNumber: '',
    routingNumber: ''
  };
  billedByDraft = { ...this.billedBy };

  get selectedCustomer(): Customer | undefined {
    const custId = this.quoteForm.get('customerId')?.value;
    return this.customers.find(c => c.customerId === custId || String(c.id) === custId);
  }
  
  // Toggle states
  showTerms = false;
  showNotes = false;
  showAdvanced = false;
  showSignature = false;
  showAttachments = false;
  showEmail = false;
  showAddress = false;
  showPhone = false;

  // Additional Option data bindings
  signatureText = '';
  contactPhone = '';
  contactEmail = '';
  contactAddress = '';
  attachmentFileName = '';
  
  // Discount & Additional charges
  discountType: 'PERCENTAGE' | 'FIXED' = 'PERCENTAGE';
  discountValue = 0;
  additionalCharges = 0;
  
  // Currency
  currencies = ['NGN', 'USD', 'EUR', 'GBP'];
  
  // Calculated totals
  subtotal: number = 0;
  totalTax: number = 0;
  discountAmount: number = 0;
  grandTotal: number = 0;

  // Template quotes
  selectedTemplate: QuoteTemplate | null = null;
  logoFileName = '';
  logoUrl = '';

  selectedCustomerBankAccounts: CustomerBankDetails[] = [];
  loadedQuoteSelectedCustomerBank?: CustomerBankDetails;
  quickCustomerForm!: FormGroup;

  get quoteDataForTemplate(): any {
    const selectedBankIdx = this.quoteForm.get('selectedCustomerBankIndex')?.value;
    let selectedCustomerBank: any = undefined;
    if (selectedBankIdx !== undefined && selectedBankIdx !== null && selectedBankIdx >= 0 && selectedBankIdx < this.selectedCustomerBankAccounts.length) {
      selectedCustomerBank = this.selectedCustomerBankAccounts[selectedBankIdx];
    } else if (this.isEditMode && this.loadedQuoteSelectedCustomerBank) {
      selectedCustomerBank = this.loadedQuoteSelectedCustomerBank;
    }

    return {
      customerId: this.quoteForm.get('customerId')?.value,
      customerName: this.quoteForm.get('customerName')?.value,
      customerEmail: this.customers.find(c => c.id === this.quoteForm.get('customerId')?.value)?.email,
      currency: this.quoteForm.get('currency')?.value,
      items: this.items.getRawValue().map((item: any) => ({
        ...item,
        total: item.total || 0,
        taxAmount: item.taxAmount || 0
      })),
      subtotal: this.subtotal,
      taxAmount: this.totalTax,
      discountAmount: this.discountAmount,
      additionalCharges: this.additionalCharges,
      additionalChargeItems: this.additionalChargeItems,
      totalAmount: this.grandTotal,
      notes: this.quoteForm.get('notes')?.value,
      terms: this.quoteForm.get('terms')?.value,
      validUntil: this.quoteForm.get('validUntil')?.value,
      quoteDate: this.quoteForm.get('quoteDate')?.value,
      logoUrl: this.logoUrl,
      selectedCustomerBank: selectedCustomerBank
    };
  }
  
  // Delivery action
  selectedAction: 'pdf' | 'email' | 'both' = 'pdf';
  
  // Make router available to template
  router: Router;
  
  private destroy$ = new Subject<void>();

  companyName = '';

  constructor(
    private messageService: MessageService,
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private salesService: SalesService,
    private companyProfileService: CompanyProfileService,
    private cdr: ChangeDetectorRef,
    private pdfGenerationService: PdfGenerationService,
    private salesEmailService: SalesEmailService,
    router: Router
  ) {
    this.router = router;
    
    // Calculate default valid until date (30 days from now)
    const defaultValidUntil = new Date();
    defaultValidUntil.setDate(defaultValidUntil.getDate() + 30);
    
    this.quoteForm = this.fb.group({
      customerId: ['', Validators.required],
      customerName: [''],
      quoteNumber: [{ value: 'Auto-generated', disabled: true }],
      quoteDate: [this.formatDateForInput(new Date()), Validators.required],
      validUntil: [this.formatDateForInput(defaultValidUntil), [Validators.required, futureDateValidator()]],
      currency: ['NGN', Validators.required],
      notes: [''],
      terms: [''],
      items: this.fb.array([]),
      selectedCustomerBankIndex: [-1]
    });

    this.quickCustomerForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(100)]],
      email: ['', [Validators.required, Validators.email]],
      phone: ['', [Validators.pattern(/^[0-9+\-\s()]{7,20}$/)]],  // phone is optional
      address: ['', [Validators.required, Validators.minLength(5), Validators.maxLength(255)]],
      taxId: ['', [Validators.maxLength(50)]],
      savePermanently: [true],
      bankAccounts: this.fb.array([])
    });
  }

  ngOnInit(): void {
    this.quoteId = this.editId || this.route.snapshot.paramMap.get('id') || '';
    this.isEditMode = !!this.quoteId;

    if (!this.customerId) {
      this.customerId = this.route.snapshot.queryParamMap.get('customerId') || '';
    }
    this.productId = this.route.snapshot.queryParamMap.get('productId') || '';
    if (!this.duplicateId) {
      this.duplicateId = this.route.snapshot.queryParamMap.get('duplicateId') || '';
    }

    this.setupFormListeners();

    // Load the tenant's own merchant info ("Prepared By") — falls back to the generic
    // company profile below if none has been set up yet via the Sender Details modal.
    if (!this.isEditMode) {
      this.salesService.getMyMerchantInfo().pipe(takeUntil(this.destroy$)).subscribe(merchant => {
        if (!merchant) return;
        this.merchantInfoId = merchant.id;
        this.billedBy = {
          name: merchant.companyName || merchant.name || '',
          email: merchant.email || '',
          phone: merchant.phone || '',
          address: Array.isArray(merchant.address) ? merchant.address.join(', ') : (merchant.address || ''),
          bankName: merchant.bankDetails?.bankName || '',
          accountName: merchant.bankDetails?.accountName || '',
          accountNumber: merchant.bankDetails?.accountNumber || '',
          routingNumber: merchant.website || ''
        };
        this.billedByDraft = { ...this.billedBy };
        this.companyName = this.billedBy.name;
        if (merchant.logoUrl?.[0]) {
          this.logoUrl = merchant.logoUrl[0];
          this.logoFileName = 'Company Logo';
        }
      });
    }

    // Fallback: fill in anything merchant info didn't have, from the generic company profile.
    this.companyProfileService.companyProfile$.pipe(takeUntil(this.destroy$)).subscribe(profile => {
      if (profile) {
        if (profile.logoUrl && !this.isEditMode) {
          this.logoUrl = profile.logoUrl;
          this.logoFileName = 'Company Logo';
        }
        if (profile.companyName && !this.billedBy.name) {
          this.billedBy.name = profile.companyName;
          this.billedByDraft.name = profile.companyName;
          this.companyName = profile.companyName;
        }
        if (!this.billedBy.address) {
          const addr = [profile.city, profile.state, profile.country].filter(Boolean).join(', ') || profile.address || '';
          if (addr) {
            this.billedBy.address = addr;
            this.billedByDraft.address = addr;
          }
        }
        if (!this.billedBy.bankName && profile.bankName) {
          this.billedBy.bankName = profile.bankName;
          this.billedByDraft.bankName = profile.bankName;
        }
        if (!this.billedBy.accountName && profile.bankAccountName) {
          this.billedBy.accountName = profile.bankAccountName;
          this.billedByDraft.accountName = profile.bankAccountName;
        }
        if (!this.billedBy.accountNumber && profile.bankAccountNumber) {
          this.billedBy.accountNumber = profile.bankAccountNumber;
          this.billedByDraft.accountNumber = profile.bankAccountNumber;
        }
        if (!this.billedBy.email && profile.email) {
          this.billedBy.email = profile.email;
          this.billedByDraft.email = profile.email;
        }
      }
    });

    this.isLoading = true;
    forkJoin({
      customers: this.salesService.getCustomers({ page: 0, size: 100 }),
      products: this.salesService.getProducts({ page: 0, size: 100 }),
      categories: this.salesService.getCategories()
    }).pipe(takeUntil(this.destroy$)).subscribe({
      next: (res: any) => {
        this.customers = res.customers?.data || [];
        this.products = res.products?.data || [];
        this.filteredProducts = this.products;
        this.categories = res.categories || [];
        this.isLoading = false;

        if (this.isEditMode) {
          this.loadQuote();
        } else if (this.duplicateId) {
          this.loadQuoteForDuplicate();
        } else {
          if (this.customerId) {
            this.quoteForm.patchValue({ customerId: this.customerId });
            this.onCustomerSelect(this.customerId);
          }
          if (this.productId) {
            this.checkAndAddProductFromParam();
          } else {
            this.addLineItem();
          }
        }
      },
      error: (error: any) => {
        console.error('Error loading lookup values:', error);
        this.isLoading = false;
        this.addLineItem();
      }
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private setupFormListeners(): void {
    // Listen to item changes to recalculate totals
    this.quoteForm.get('items')?.valueChanges.subscribe(() => {
      this.calculateTotals();
    });
  }

  // ============ WIZARD NAVIGATION ============
  
  goToStep(step: 1 | 2 | 3): void {
    // Validate before going forward
    if (step > this.currentStep) {
      if (this.currentStep === 1 && !this.validateStep1()) {
        return;
      }
      if (this.currentStep === 2 && !this.validateStep2()) {
        return;
      }
    }
    this.currentStep = step;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  nextStep(): void {
    if (this.currentStep === 1) {
      if (this.validateStep1()) {
        this.currentStep = 2;
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } else if (this.currentStep === 2) {
      if (this.validateStep2()) {
        this.currentStep = 3;
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }
  }

  prevStep(): void {
    if (this.currentStep > 1) {
      this.currentStep = (this.currentStep - 1) as 1 | 2;
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  proceedToTemplateSelection(): void {
    this.nextStep();
  }

  onHeaderActionClick(): void {
    if (this.currentStep === 1) {
      this.nextStep();
    } else if (this.currentStep === 2) {
      this.nextStep();
    } else if (this.currentStep === 3) {
      this.onSubmit();
    }
  }

  // ============ STEP VALIDATION ============
  
  private validateStep1(): boolean {
    console.log('Validating Step 1 (Quote Details & Line Items)...');
    
    // Debugger: print form status and invalid controls
    if (this.quoteForm.invalid) {
      console.warn('Form validation failed. Invalid form fields:');
      Object.keys(this.quoteForm.controls).forEach(key => {
        const control = this.quoteForm.get(key);
        if (control?.invalid) {
          console.warn(`- Control "${key}" is invalid. Value:`, control.value, 'Errors:', control.errors);
        }
      });
    }

    // Validate customer selection
    if (!this.quoteForm.get('customerId')?.value) {
      this.messageService.add({ severity: 'warn', summary: 'Warning', detail: 'Please select a customer' });
      return false;
    }
    
    // Validate date fields
    if (!this.quoteForm.get('quoteDate')?.value) {
      this.messageService.add({ severity: 'warn', summary: 'Warning', detail: 'Please select a quote date' });
      return false;
    }
    
    if (!this.quoteForm.get('validUntil')?.value) {
      this.messageService.add({ severity: 'warn', summary: 'Warning', detail: 'Please select a valid until date' });
      return false;
    }

    if (this.quoteForm.get('validUntil')?.invalid) {
      const errors = this.quoteForm.get('validUntil')?.errors;
      if (errors?.['pastDate']) {
        this.messageService.add({ severity: 'warn', summary: 'Warning', detail: 'Valid until date cannot be in the past' });
        return false;
      }
    }

    // Validate at least one item
    if (this.items.length === 0) {
      this.messageService.add({ severity: 'warn', summary: 'Warning', detail: 'Please add at least one item to the quote' });
      return false;
    }
    
    // Validate each item
    for (let i = 0; i < this.items.length; i++) {
      const item = this.items.at(i);
      if (item.invalid) {
        console.warn(`- Item ${i + 1} is invalid. Errors:`, item.errors);
        Object.keys((item as FormGroup).controls).forEach(key => {
          const ctrl = item.get(key);
          if (ctrl?.invalid) {
            console.warn(`  - Sub-control "${key}" is invalid. Value:`, ctrl.value, 'Errors:', ctrl.errors);
          }
        });
      }
      
      if (!item.get('productName')?.value) {
        this.messageService.add({ severity: 'warn', summary: 'Warning', detail: `Item ${i + 1}: Please enter an item name` });
        return false;
      }
      
      const qty = item.get('quantity')?.value;
      if (qty === null || qty === undefined || qty < 1) {
        this.messageService.add({ severity: 'warn', summary: 'Warning', detail: `Item ${i + 1}: Please enter a valid quantity (min 1)` });
        return false;
      }
      
      const price = item.get('unitPrice')?.value;
      if (price === null || price === undefined || price < 0) {
        this.messageService.add({ severity: 'warn', summary: 'Warning', detail: `Item ${i + 1}: Please enter a valid price (min 0)` });
        return false;
      }
    }
    
    return true;
  }

  private validateStep2(): boolean {
    if (!this.selectedTemplate) {
      // Default to Standard template if none selected explicitly
      this.selectedTemplate = {
        id: 'standard',
        name: 'Standard Professional',
        description: 'Clean, balanced layout with all essential business information',
        sections: {
          showCustomerDetails: true,
          showCompanyLogo: true,
          showTaxBreakdown: true,
          showShippingDetails: true,
          showPaymentTerms: true,
          showNotes: true,
          showTermsConditions: true,
          showSignature: true,
          showAttachments: false,
          showItemImages: false,
          showSKU: true,
          showSerialNumbers: false,
          showBatchDetails: false,
          showSubtotalPerGroup: true,
          showTotalInWords: true,
          showCurrencySymbol: true,
          showVendorInfo: true,
          showCustomFields: false
        },
        layout: 'standard',
        fontSize: 'medium',
        colorTheme: 'professional'
      };
    }
    return true;
  }

  // Form Arrays
  get items(): FormArray {
    return this.quoteForm.get('items') as FormArray;
  }

  addLineItem(): void {
    const itemForm = this.fb.group({
      productId: [''],
      productName: ['', Validators.required],
      description: [''],
      quantity: [1, [Validators.required, Validators.min(1)]],
      unitPrice: [0, [Validators.required, Validators.min(0)]],
      taxRate: [0, [Validators.min(0), Validators.max(100)]],
      total: [{ value: 0, disabled: true }],
      taxAmount: [{ value: 0, disabled: true }]
    });
    
    this.items.push(itemForm);
    
    // Subscribe to changes for this item
    itemForm.get('quantity')?.valueChanges.subscribe(() => this.calculateItemTotal(itemForm));
    itemForm.get('unitPrice')?.valueChanges.subscribe(() => this.calculateItemTotal(itemForm));
    itemForm.get('taxRate')?.valueChanges.subscribe(() => this.calculateItemTotal(itemForm));
  }

  removeLineItem(index: number): void {
    this.items.removeAt(index);
    // Shift category index maps to keep them aligned
    const newSelectedCategoryForIndex: { [key: number]: string } = {};
    for (let i = 0; i < this.items.length; i++) {
      const oldIndex = i >= index ? i + 1 : i;
      if (this.selectedCategoryForIndex[oldIndex]) {
        newSelectedCategoryForIndex[i] = this.selectedCategoryForIndex[oldIndex];
      }
    }
    this.selectedCategoryForIndex = newSelectedCategoryForIndex;
    this.calculateTotals();
  }

  private calculateItemTotal(itemForm: AbstractControl): void {
    const quantity = itemForm.get('quantity')?.value || 0;
    const unitPrice = itemForm.get('unitPrice')?.value || 0;
    const taxRate = itemForm.get('taxRate')?.value || 0;
    
    const total = quantity * unitPrice;
    const taxAmount = total * (taxRate / 100);
    
    itemForm.patchValue({ total: total, taxAmount: taxAmount }, { emitEvent: false });
    this.calculateTotals();
  }

  calculateTotals(): void {
    this.subtotal = 0;
    this.totalTax = 0;
    
    for (let i = 0; i < this.items.length; i++) {
      const item = this.items.at(i);
      const total = item.get('total')?.value || 0;
      const taxAmount = item.get('taxAmount')?.value || 0;
      
      this.subtotal += total;
      this.totalTax += taxAmount;
    }
    
    if (this.discountType === 'PERCENTAGE') {
      this.discountAmount = this.subtotal * (this.discountValue / 100);
    } else {
      this.discountAmount = this.discountValue;
    }
    this.additionalCharges = this.additionalChargeItems.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    this.grandTotal = Math.max(0, this.subtotal + this.totalTax - this.discountAmount + this.additionalCharges);
  }

  // Product selection
  onProductSelect(index: number, event: any): void {
    const productId = event?.target?.value || event?.value || '';
    if (!productId) return;
    
    const product = this.products.find(p => String(p.id) === String(productId) || p.productId === productId);
    if (product) {
      const itemForm = this.items.at(index);
      itemForm.patchValue({
        productName: product.name,
        description: product.description,
        unitPrice: product.unitPrice || product.sellingPrice,
        taxRate: product.taxRate || 0
      });
      this.calculateItemTotal(itemForm);
    }
  }

  openNewProductModal(index: number): void {
    this.newProductTargetIndex = index;
    this.newProduct = { name: '', description: '', unitPrice: 0, taxRate: 0 };
    this.newProductError = '';
    this.showNewProductModal = true;
  }

  saveNewProduct(): void {
    this.newProductError = '';
    if (!this.newProduct.name.trim()) {
      this.newProductError = 'Product name is required.';
      return;
    }
    this.isSavingProduct = true;
    this.salesService.createProduct({
      name: this.newProduct.name.trim(),
      description: this.newProduct.description || '',
      unitPrice: this.newProduct.unitPrice || 0,
      sellingPrice: this.newProduct.unitPrice || 0,
      taxRate: this.newProduct.taxRate || 0
    }).pipe(takeUntil(this.destroy$)).subscribe({
      next: (created: Product) => {
        this.products = [...this.products, created];
        this.filteredProducts = this.products;
        const itemForm = this.items.at(this.newProductTargetIndex);
        itemForm.patchValue({
          productId: created.id,
          productName: created.name,
          description: created.description || '',
          unitPrice: created.unitPrice || created.sellingPrice || 0,
          taxRate: created.taxRate || 0
        });
        this.calculateItemTotal(itemForm);
        this.isSavingProduct = false;
        this.showNewProductModal = false;
        this.messageService.add({ severity: 'success', summary: 'Product Created', detail: `"${created.name}" added to catalog.` });
      },
      error: () => {
        this.newProductError = 'Failed to create product. Please try again.';
        this.isSavingProduct = false;
      }
    });
  }

  filterProducts(): void {
    if (this.searchProductTerm) {
      const term = this.searchProductTerm.toLowerCase();
      this.filteredProducts = this.products.filter(p => 
        p.name.toLowerCase().includes(term) || 
        p.sku.toLowerCase().includes(term)
      );
    } else {
      this.filteredProducts = this.products;
    }
  }

  selectProductFromModal(product: Product, index: number): void {
    const itemForm = this.items.at(index);
    itemForm.patchValue({
      productId: product.id,
      productName: product.name,
      description: product.description,
      unitPrice: product.unitPrice || product.sellingPrice,
      taxRate: product.taxRate || 0
    });
    this.calculateItemTotal(itemForm);
    this.showProductModal = false;
    this.searchProductTerm = '';
  }

  // Customer selection
  onCustomerSelect(customerId: string): void {
    const customer = this.customers.find(c => c.customerId === customerId || String(c.id) === customerId);
    if (customer) {
      this.quoteForm.patchValue({ customerName: customer.name });
      this.selectedCustomerBankAccounts = customer.bankAccounts || [];
      if (this.selectedCustomerBankAccounts.length > 0) {
        if (this.loadedQuoteSelectedCustomerBank) {
          const index = this.selectedCustomerBankAccounts.findIndex(
            b => b.accountNumber === this.loadedQuoteSelectedCustomerBank?.accountNumber && b.bankName === this.loadedQuoteSelectedCustomerBank?.bankName
          );
          if (index >= 0) {
            this.quoteForm.patchValue({ selectedCustomerBankIndex: index });
          } else {
            this.quoteForm.patchValue({ selectedCustomerBankIndex: 0 });
          }
        } else {
          this.quoteForm.patchValue({ selectedCustomerBankIndex: 0 });
        }
      } else {
        this.quoteForm.patchValue({ selectedCustomerBankIndex: -1 });
      }
    } else {
      this.selectedCustomerBankAccounts = [];
      this.quoteForm.patchValue({ selectedCustomerBankIndex: -1 });
    }
  }

  // Load data
  private loadCustomers(): void {
    this.salesService.getCustomers({ page: 0, size: 100 }).subscribe({
      next: (response: any) => {
        this.customers = response.data;
        if (this.customerId) {
          this.quoteForm.patchValue({ customerId: this.customerId });
          this.onCustomerSelect(this.customerId);
        }
        this.checkAndAddProductFromParam();
      },
      error: (error: any) => {
        console.error('Error loading customers:', error);
        this.checkAndAddProductFromParam();
      }
    });
  }

  private loadProducts(): void {
    this.salesService.getProducts({ page: 0, size: 100 }).subscribe({
      next: (response: any) => {
        this.products = response.data;
        this.filteredProducts = this.products;
        this.checkAndAddProductFromParam();
        this.initializeCategoriesForExistingItems();
      },
      error: (error: any) => {
        console.error('Error loading products:', error);
        this.checkAndAddProductFromParam();
      }
    });
  }

  private loadCategories(): void {
    this.salesService.getCategories().subscribe({
      next: (cats: any[]) => {
        this.categories = (cats || []).map(c => c.name).filter(Boolean);
      },
      error: (err) => {
        console.error('Error loading categories:', err);
      }
    });
  }

  getProductsForIndex(index: number): Product[] {
    const selectedCategory = this.selectedCategoryForIndex[index];
    const itemForm = this.items.at(index);
    const selectedProductId = itemForm?.get('productId')?.value;

    let list = this.products;
    if (selectedCategory) {
      list = this.products.filter(p => {
        const catName = typeof p.category === 'object' ? p.category?.name : p.category;
        return catName?.toLowerCase() === selectedCategory.toLowerCase();
      });
    }

    if (selectedProductId) {
      const selectedProduct = this.products.find(p => String(p.id) === String(selectedProductId));
      if (selectedProduct && !list.some(p => String(p.id) === String(selectedProductId))) {
        list = [...list, selectedProduct];
      }
    }

    return list;
  }

  onCategoryChange(index: number, category: string): void {
    this.selectedCategoryForIndex[index] = category;
    
    // Clear product selection for this row if the current product is not in the new category
    const itemForm = this.items.at(index);
    const currentProductId = itemForm.get('productId')?.value;
    if (currentProductId) {
      const product = this.products.find(p => String(p.id) === String(currentProductId));
      if (product) {
        const catName = typeof product.category === 'object' ? product.category?.name : product.category;
        if (catName?.toLowerCase() !== category.toLowerCase() && category !== '') {
          itemForm.patchValue({
            productId: '',
            productName: '',
            description: '',
            unitPrice: 0,
            total: 0,
            taxAmount: 0
          });
          this.calculateItemTotal(itemForm);
        }
      }
    }
  }

  initializeCategoriesForExistingItems(): void {
    if (this.items && this.items.length > 0) {
      for (let i = 0; i < this.items.length; i++) {
        const itemForm = this.items.at(i);
        const productId = itemForm.get('productId')?.value;
        if (productId) {
          const product = this.products.find(p => String(p.id) === String(productId));
          if (product) {
            const catName = typeof product.category === 'object' ? product.category?.name : product.category;
            if (catName) {
              this.selectedCategoryForIndex[i] = catName;
            }
          }
        }
      }
    }
  }

  /** Coming from the (Inventory-backed) Product Catalog's "Create Quote" button — it can't
   *  rely on the product existing in this form's own product list (a separate, Sales-side
   *  list), so it passes the product's details directly via query params instead of just an
   *  id. Builds the line item straight from those, no lookup needed. Returns true if it did. */
  private addLineItemFromCatalogQueryParams(): boolean {
    const qp = this.route.snapshot.queryParamMap;
    const productName = qp.get('productName');
    if (!productName || this.items.length > 0) return false;

    this.addLineItem();
    const itemForm = this.items.at(this.items.length - 1);
    itemForm.patchValue({
      productId: qp.get('productId') || '',
      productName,
      description: qp.get('productDescription') || '',
      quantity: 1,
      unitPrice: Number(qp.get('productUnitPrice')) || 0,
      taxRate: Number(qp.get('productTaxRate')) || 0
    });
    this.calculateItemTotal(itemForm);

    if (this.customers && this.customers.length > 0) {
      const firstCustomer = this.customers[0];
      this.quoteForm.patchValue({
        customerId: firstCustomer.customerId || String(firstCustomer.id),
        customerName: firstCustomer.name
      });
      this.onCustomerSelect(firstCustomer.customerId || String(firstCustomer.id));
    }
    this.currentStep = 1;
    if (!this.selectedTemplate) {
      this.selectedTemplate = {
        id: 'standard',
        name: 'Standard Professional',
        description: 'Clean, balanced layout with all essential business information',
        sections: {
          showCustomerDetails: true,
          showCompanyLogo: true,
          showTaxBreakdown: true,
          showShippingDetails: true,
          showPaymentTerms: true,
          showNotes: true,
          showTermsConditions: true,
          showSignature: true,
          showAttachments: false,
          showItemImages: false,
          showSKU: true,
          showSerialNumbers: false,
          showBatchDetails: false,
          showSubtotalPerGroup: true,
          showTotalInWords: true,
          showCurrencySymbol: true,
          showVendorInfo: true,
          showCustomFields: false
        },
        layout: 'standard',
        fontSize: 'medium',
        colorTheme: 'professional'
      };
    }
    return true;
  }

  private checkAndAddProductFromParam(): void {
    if (!this.isEditMode && this.productId) {
      if (this.addLineItemFromCatalogQueryParams()) return;

      const product = this.products.find(p => String(p.id) === String(this.productId) || p.productId === this.productId);
      if (product && this.items.length === 0) {
        // Clear items form array first to avoid empty/default item
        while (this.items.length) {
          this.items.removeAt(0);
        }
        
        // Add new line item
        this.addLineItem();
        const index = this.items.length - 1;
        const itemForm = this.items.at(index);
        itemForm.patchValue({
          // Use the internal product identifier for the select control
          productId: String(product.id),
          productName: product.name,
          description: product.description || '',
          quantity: 1,
          unitPrice: product.unitPrice || product.sellingPrice,
          taxRate: product.taxRate || 0
        });
        
        this.calculateItemTotal(itemForm);
        
        // Select the first customer as default if available
        if (this.customers && this.customers.length > 0) {
          const firstCustomer = this.customers[0];
          this.quoteForm.patchValue({
            customerId: firstCustomer.customerId || String(firstCustomer.id),
            customerName: firstCustomer.name
          });
          this.onCustomerSelect(firstCustomer.customerId || String(firstCustomer.id));
        }
        
        // Stay on Step 2 (Line Items) so the seller can edit details before moving to template preview
        // this.currentStep = 3;
        this.currentStep = 1;
        
        // Set a default template if not set
        if (!this.selectedTemplate) {
          this.selectedTemplate = {
            id: 'standard',
            name: 'Standard Professional',
            description: 'Clean, balanced layout with all essential business information',
            sections: {
              showCustomerDetails: true,
              showCompanyLogo: true,
              showTaxBreakdown: true,
              showShippingDetails: true,
              showPaymentTerms: true,
              showNotes: true,
              showTermsConditions: true,
              showSignature: true,
              showAttachments: false,
              showItemImages: false,
              showSKU: true,
              showSerialNumbers: false,
              showBatchDetails: false,
              showSubtotalPerGroup: true,
              showTotalInWords: true,
              showCurrencySymbol: true,
              showVendorInfo: true,
              showCustomFields: false
            },
            layout: 'standard',
            fontSize: 'medium',
            colorTheme: 'professional'
          };
        }
      } else if (product && this.items.length > 0 && !this.quoteForm.get('customerId')?.value && this.customers && this.customers.length > 0) {
        // Populate customer default if customer list finishes loading after product
        const firstCustomer = this.customers[0];
        this.quoteForm.patchValue({
          customerId: firstCustomer.id,
          customerName: firstCustomer.name
        });
      }
    }
  }

  private loadQuote(): void {
    this.isLoading = true;
    this.salesService.getQuoteById(this.quoteId).subscribe({
      next: (quote: Quote | null) => {
        if (quote) {
          this.populateForm(quote);
          this.initializeCategoriesForExistingItems();
        }
        this.isLoading = false;
      },
      error: (error: any) => {
        console.error('Error loading quote:', error);
        this.isLoading = false;
      }
    });
  }

  // Copy an existing quote's details into this (still-new) form so the user can
  // review/edit before it is saved and sent as a brand-new quote.
  private loadQuoteForDuplicate(): void {
    // The list screen already has the full quote in memory and hands it over via
    // router state, so the common "duplicate from the list" path is instant and
    // needs no round-trip. Only hit the network as a fallback — e.g. a deep link,
    // a page refresh, or the state having been lost some other way.
    const passedQuote = (history.state as any)?.duplicateSource as Quote | undefined;
    if (passedQuote && String(passedQuote.id) === this.duplicateId) {
      this.applyDuplicateSource(passedQuote);
      return;
    }

    this.isLoading = true;
    this.salesService.getQuoteById(this.duplicateId!).subscribe({
      next: (quote: Quote | null) => {
        if (quote) {
          this.applyDuplicateSource(quote);
        }
        this.isLoading = false;
      },
      error: (error: any) => {
        console.error('Error loading quote to duplicate:', error);
        this.isLoading = false;
      }
    });
  }

  private applyDuplicateSource(quote: Quote): void {
    this.populateForm(quote);
    this.initializeCategoriesForExistingItems();

    // Refresh the dates rather than carrying over the original quote's -
    // this is a new quote being drafted today, not an edit of the old one.
    const defaultValidUntil = new Date();
    defaultValidUntil.setDate(defaultValidUntil.getDate() + 30);
    this.quoteForm.patchValue({
      quoteDate: this.formatDateForInput(new Date()),
      validUntil: this.formatDateForInput(defaultValidUntil)
    });
  }

  private populateForm(quote: Quote): void {
    this.loadedQuoteSelectedCustomerBank = quote.selectedCustomerBank;
    const addOpts = Array.isArray(quote.additionalOptions) ? quote.additionalOptions[0] : (quote.additionalOptions as any);
    
    let custId = '';
    if (quote.customerId) {
      if (typeof quote.customerId === 'object') {
        custId = quote.customerId.customerId || String(quote.customerId.id || '');
      } else {
        custId = String(quote.customerId);
      }
    }
    
    let custName = '';
    if (quote.customerName) {
      if (typeof quote.customerName === 'object') {
        custName = quote.customerName.name || String(quote.customerName);
      } else {
        custName = String(quote.customerName);
      }
    } else if (typeof quote.customerId === 'object' && quote.customerId) {
      custName = quote.customerId.name || '';
    }

    this.quoteForm.patchValue({
      customerId: custId,
      customerName: custName,
      currency: quote.currency,
      quoteDate: this.formatDateForInput(quote.createdAt),
      validUntil: this.formatDateForInput(quote.validUntil),
      notes: (quote as any).notes || addOpts?.notes || '',
      terms: (quote as any).terms || addOpts?.terms || ''
    });
    this.onCustomerSelect(custId);
    
    if (quote.merchantDetails) {
      this.billedBy = {
        name: quote.merchantDetails.name || quote.merchantDetails.companyName || '',
        email: quote.merchantDetails.email || '',
        phone: quote.merchantDetails.phone || '',
        address: Array.isArray(quote.merchantDetails.address) ? quote.merchantDetails.address.join(', ') : (quote.merchantDetails.address || ''),
        bankName: quote.merchantDetails.bankDetails?.bankName || '',
        accountName: quote.merchantDetails.bankDetails?.accountName || '',
        accountNumber: quote.merchantDetails.bankDetails?.accountNumber || '',
        routingNumber: quote.merchantDetails.website || ''
      };
      this.billedByDraft = { ...this.billedBy };
    }
    
    this.logoUrl = quote.logoUrl?.[0] || '';
    this.logoFileName = quote.logoUrl?.[0] ? 'Saved Logo' : '';
    
    if (addOpts) {
      if (addOpts.signatureText) {
        this.showSignature = true;
        this.signatureText = addOpts.signatureText;
      }
      const firstAtt = Array.isArray(addOpts.attachments) ? addOpts.attachments[0] : addOpts.attachments;
      if (firstAtt?.fileName) {
        this.showAttachments = true;
        this.attachmentFileName = firstAtt.fileName;
      }
      if (addOpts.email) {
        this.showEmail = true;
        this.contactEmail = addOpts.email;
      }
      if (addOpts.address) {
        this.showAddress = true;
        this.contactAddress = addOpts.address;
      }
      if (addOpts.phone) {
        this.showPhone = true;
        this.contactPhone = addOpts.phone;
      }
      if (addOpts.notes) {
        this.showNotes = true;
      }
      if (addOpts.terms) {
        this.showTerms = true;
      }
    }
    
    if (Array.isArray(quote.additionalCharges)) {
      const labels = quote.additionalChargesLabel || [];
      this.additionalChargeItems = quote.additionalCharges.map((amt, idx) => ({
        id: idx + 1,
        label: labels[idx] || `Charge #${idx + 1}`,
        amount: Number(amt) || 0
      }));
    } else if (typeof (quote as any).additionalCharges === 'number' && (quote as any).additionalCharges > 0) {
      this.additionalChargeItems = [{
        id: 1,
        label: 'Additional Charge',
        amount: Number((quote as any).additionalCharges)
      }];
    }
    
    // Clear existing items
    while (this.items.length) {
      this.items.removeAt(0);
    }
    
    // Add items from quote
    quote.items.forEach((item: QuoteItem) => {
      this.addLineItem();
      const index = this.items.length - 1;
      const itemForm = this.items.at(index);
      itemForm.patchValue({
        productId: item.productId,
        productName: item.productName,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        taxRate: 0
      });
      this.calculateItemTotal(itemForm);
    });
  }

  onFileSelected(event: any): void {
    const file = event.target.files?.[0];
    if (file) {
      this.attachmentFileName = file.name;
    }
  }

  onLogoSelected(event: any): void {
    const file = event.target.files?.[0];
    if (file) {
      this.logoFileName = file.name;
      const reader = new FileReader();
      reader.onload = () => {
        this.logoUrl = reader.result as string;
      };
      reader.readAsDataURL(file);
    }
  }

  // Submit
  onSubmit(): void {
    if (this.quoteForm.invalid) {
      this.quoteForm.markAllAsTouched();
      
      console.warn('Form submission blocked. Invalid fields:');
      Object.keys(this.quoteForm.controls).forEach(key => {
        const control = this.quoteForm.get(key);
        if (control?.invalid) {
          console.warn(`- Control "${key}" is invalid. Value:`, control.value, 'Errors:', control.errors);
        }
      });
      // Also log items FormArray invalid fields
      for (let i = 0; i < this.items.length; i++) {
        const item = this.items.at(i);
        if (item.invalid) {
          console.warn(`- Item ${i + 1} is invalid. Errors:`, item.errors);
          Object.keys((item as FormGroup).controls).forEach(key => {
            const ctrl = item.get(key);
            if (ctrl?.invalid) {
              console.warn(`  - Sub-control "${key}" is invalid. Value:`, ctrl.value, 'Errors:', ctrl.errors);
            }
          });
        }
      }
      return;
    }

    if (this.items.length === 0) {
      this.messageService.add({ severity: 'warn', summary: 'Warning', detail: 'Please add at least one item to the quote' });
      return;
    }

    this.isSubmitting = true;
    const formValue = this.quoteForm.value;

    // Build items matching QuoteItemDTO exactly:
    // productId → Long|null, productName → String (@NotBlank), quantity → Integer, unitPrice → BigDecimal
    const items = this.items.controls.map(ctrl => {
      const raw = (ctrl as any).getRawValue();
      const pid = raw.productId !== '' && raw.productId != null ? Number(raw.productId) : null;
      return {
        productId: pid && !isNaN(pid) ? pid : null,
        productName: raw.productName || '',
        description: raw.description || '',
        quantity: Number(raw.quantity) || 1,
        unitPrice: Number(raw.unitPrice) || 0,
        discount: 0,
        total: Number(raw.total) || 0
      };
    });

    const customerObj = this.customers.find(c =>
      c.customerId === formValue.customerId || String(c.id) === String(formValue.customerId)
    ) || { id: null, name: formValue.customerName || '' } as any;

    // selectedCustomerBankId: send the bank's id if known
    const selectedBankIdx = formValue.selectedCustomerBankIndex;
    let selectedCustomerBankId: number | null = null;
    if (selectedBankIdx != null && selectedBankIdx >= 0 && selectedBankIdx < this.selectedCustomerBankAccounts.length) {
      const bank = this.selectedCustomerBankAccounts[selectedBankIdx] as any;
      selectedCustomerBankId = bank.id || null;
    }

    // Payload matches QuoteDTO exactly — no extra fields
    const quoteData: any = {
      customerId: customerObj.id ? Number(customerObj.id) : null,
      currency: formValue.currency || 'NGN',
      validUntil: formValue.validUntil ? new Date(formValue.validUntil).toISOString() : null,
      expiresAt: formValue.validUntil ? new Date(formValue.validUntil).toISOString() : null,
      notes: formValue.notes || '',
      terms: formValue.terms || '',
      logoUrl: this.logoUrl || null,
      selectedCustomerBankId: selectedCustomerBankId,
      status: 'DRAFT' as QuoteStatus,
      subtotal: this.subtotal,
      taxAmount: this.totalTax,
      discountAmount: this.discountAmount,
      totalAmount: this.grandTotal,
      additionalCharges: this.additionalChargeItems.map(c => c.amount),
      additionalChargesLabel: this.additionalChargeItems.map(c => c.label),
      items: items
    };
    
    let request;
    if (this.isEditMode) {
      request = this.salesService.updateQuote(this.quoteId, quoteData);
    } else {
      request = this.salesService.createQuote(quoteData);
    }
    
    request.subscribe({
      next: async (response: Quote) => {
        this.isSubmitting = false;
        
        // Handle delivery action
        await this.handleDeliveryAction(response, this.selectedAction);
      },
      error: (error: any) => {
        console.error('Error saving quote:', error);
        this.isSubmitting = false;
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to save quote. Please try again.' });
      }
    });
  }

  isSavingDraft = false;

  saveDraft(): void {
    if (this.isSavingDraft || this.isSubmitting) return;
    this.isSavingDraft = true;
    const formValue = this.quoteForm.getRawValue();

    const items = this.items.controls.map(ctrl => {
      const raw = (ctrl as any).getRawValue();
      const pid = raw.productId !== '' && raw.productId != null ? Number(raw.productId) : null;
      return {
        productId: pid && !isNaN(pid) ? pid : null,
        productName: raw.productName || 'Untitled Item',
        description: raw.description || '',
        quantity: Number(raw.quantity) || 1,
        unitPrice: Number(raw.unitPrice) || 0,
        discount: 0,
        total: Number(raw.total) || 0
      };
    });

    const customerObj = this.customers.find(c =>
      c.customerId === formValue.customerId || String(c.id) === String(formValue.customerId)
    ) || { id: null, name: formValue.customerName || '' } as any;

    const selectedBankIdx = formValue.selectedCustomerBankIndex;
    let selectedCustomerBankId: number | null = null;
    if (selectedBankIdx != null && selectedBankIdx >= 0 && selectedBankIdx < this.selectedCustomerBankAccounts.length) {
      selectedCustomerBankId = (this.selectedCustomerBankAccounts[selectedBankIdx] as any).id || null;
    }

    const draftData: any = {
      customerId: customerObj.id ? Number(customerObj.id) : null,
      currency: formValue.currency || 'NGN',
      validUntil: formValue.validUntil ? new Date(formValue.validUntil).toISOString() : null,
      expiresAt: formValue.validUntil ? new Date(formValue.validUntil).toISOString() : null,
      notes: formValue.notes || '',
      terms: formValue.terms || '',
      logoUrl: this.logoUrl || null,
      selectedCustomerBankId,
      status: 'DRAFT' as QuoteStatus,
      subtotal: this.subtotal,
      taxAmount: this.totalTax,
      discountAmount: this.discountAmount,
      totalAmount: this.grandTotal,
      additionalCharges: this.additionalChargeItems.map(c => c.amount),
      additionalChargesLabel: this.additionalChargeItems.map(c => c.label),
      items: items.length ? items : [{ productName: 'Draft', quantity: 1, unitPrice: 0, discount: 0, total: 0 }]
    };

    const req = this.isEditMode
      ? this.salesService.updateQuote(this.quoteId, draftData)
      : this.salesService.createQuote(draftData);

    req.pipe(takeUntil(this.destroy$)).subscribe({
      next: (saved: Quote) => {
        this.isSavingDraft = false;
        if (!this.isEditMode && (saved as any).id) {
          this.quoteId = String((saved as any).id);
          this.isEditMode = true;
        }
        this.messageService.add({ severity: 'success', summary: 'Draft Saved', detail: 'Quote saved as draft.' });
      },
      error: () => {
        this.isSavingDraft = false;
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to save draft.' });
      }
    });
  }

  // Handle creation action from child
  onCreateAction(event: { action: 'pdf' | 'email' | 'both' }): void {
    this.selectedAction = event.action;
    this.onSubmit();
  }

  showSendQuoteModal = false;
  pendingSendQuoteNumber = '';
  pendingSendCustomerName = '';
  private pendingDeliveryQuote: Quote | null = null;

  // Handle delivery actions
  /**
   * Tries the server PDF endpoint, falls back to client-side generation on failure, and
   * downloads whichever succeeds. Never throws — a PDF failure shouldn't block email
   * sending or navigation. Awaited by both delivery paths below so that, in the "PDF +
   * Email" case, download/generation genuinely finishes before the caller navigates away —
   * navigating away tears down this component (and the step-1 preview element the client
   * fallback needs), so racing ahead of it silently kills the PDF with no user feedback.
   */
  private async downloadQuotePdf(quote: Quote): Promise<void> {
    try {
      const blob = await lastValueFrom(this.pdfGenerationService.generatePdf({
        documentType: 'QUOTATION',
        documentId: String(quote.id),
        documentNumber: quote.quoteNumber,
        tenantId: 'optimax',
        data: quote
      }));
      this.pdfGenerationService.downloadBlob(blob as any, `Quote-${quote.quoteNumber}.pdf`);
    } catch (err) {
      console.warn('[QuoteFormComponent] Server PDF failed, using client fallback:', err);
      try {
        const clientBlob = await this.generateQuotePDF(quote);
        this.pdfGenerationService.downloadBlob(clientBlob, `Quote-${quote.quoteNumber}.pdf`);
      } catch (e) {
        console.error('Client PDF generation failed:', e);
      }
    }
  }

  private async handleDeliveryAction(quote: Quote, action: 'pdf' | 'email' | 'both'): Promise<void> {
    try {
      if (action === 'pdf') {
        await this.downloadQuotePdf(quote);
        this.navigateAfterSubmit(quote);
      } else {
        // 'email' or 'both' -> Trigger custom Send Quote modal popup
        this.pendingDeliveryQuote = quote;
        const custName = (quote.customerName as any)?.name || String(quote.customerName || 'Customer');
        this.pendingSendQuoteNumber = quote.quoteNumber;
        this.pendingSendCustomerName = custName;
        this.showSendQuoteModal = true;
      }
    } catch (error) {
      console.error('Error in delivery action:', error);
      this.messageService.add({ severity: 'warn', summary: 'Warning', detail: 'There was an issue with the delivery. Please try again.' });
    }
  }

  async confirmSendQuote(): Promise<void> {
    if (!this.pendingDeliveryQuote) return;
    const quote = this.pendingDeliveryQuote;
    this.showSendQuoteModal = false;

    if (this.selectedAction === 'both') {
      await this.downloadQuotePdf(quote);
    }

    await this.sendQuoteEmail(quote);
    this.navigateAfterSubmit(quote);
  }

  private navigateAfterSubmit(response: Quote): void {
    const uuid = this.route.snapshot.paramMap.get('uuid');
    if (uuid) {
      this.router.navigate(['/quotes', response.id, uuid]);
    } else {
      this.router.navigate(['/quotes', response.id]);
    }
  }

  // Generate PDF from live preview mockup
  private async generateQuotePDF(quote: Quote): Promise<Blob> {
    this.generatedQuoteNumber = quote.quoteNumber;

    // The preview element lives only on step 1 — switch there if needed
    const prevStep = this.currentStep;
    if (this.currentStep !== 1) {
      this.currentStep = 1;
      this.cdr.detectChanges();
    }

    // Allow Angular to render the preview with the new quote number
    await new Promise(resolve => setTimeout(resolve, 200));

    const element = document.getElementById('quote-preview-document');
    if (!element) {
      this.currentStep = prevStep;
      this.generatedQuoteNumber = '';
      throw new Error('Preview document element not found');
    }

    // Clone the element into an unconstrained off-screen container so
    // html2canvas captures the full scrollable content, not just the
    // portion visible inside the overflow:auto preview column.
    const clone = element.cloneNode(true) as HTMLElement;
    clone.style.position = 'fixed';
    clone.style.top = '-99999px';
    clone.style.left = '0';
    clone.style.width = element.offsetWidth + 'px';
    clone.style.height = 'auto';
    clone.style.overflow = 'visible';
    clone.style.maxHeight = 'none';
    document.body.appendChild(clone);

    // Let the clone reflow
    await new Promise(resolve => setTimeout(resolve, 80));

    let canvas: HTMLCanvasElement;
    try {
      canvas = await html2canvas(clone, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        scrollX: 0,
        scrollY: 0
      });
    } finally {
      document.body.removeChild(clone);
    }

    // Restore step
    this.currentStep = prevStep;
    this.generatedQuoteNumber = '';
    this.cdr.detectChanges();

    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageWidth = 210;
    const pageHeight = 297;
    const imgWidth = pageWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    // Tile across multiple pages if content is taller than one A4 page
    let remaining = imgHeight;
    let yOffset = 0;
    while (remaining > 0) {
      pdf.addImage(imgData, 'PNG', 0, -yOffset, imgWidth, imgHeight);
      remaining -= pageHeight;
      yOffset += pageHeight;
      if (remaining > 0) pdf.addPage();
    }

    return pdf.output('blob');
  }

  // Send email via SalesEmailService
  private async sendQuoteEmail(quote: Quote): Promise<void> {
    const customerId = this.quoteForm.get('customerId')?.value;
    const customerObj = this.customers.find(c =>
      c.customerId === customerId || String(c.id) === String(customerId)
    );
    const email = customerObj?.email || (quote.customerName as any)?.email || (quote.customerId as any)?.email || '';
    const name = customerObj?.name || (quote.customerName as any)?.name || 'Customer';

    if (!email) {
      console.warn('Cannot send email, customer email is missing');
      this.messageService.add({ severity: 'warn', summary: 'Missing Email', detail: 'Could not find recipient email address' });
      return;
    }

    const addOpts = Array.isArray(quote.additionalOptions) ? quote.additionalOptions[0] : (quote.additionalOptions as any);
    const currency = quote.currency || 'NGN';
    const fmt = (n: number) => (n || 0).toLocaleString('en-NG');

    const itemsRows = (quote.items || []).map(item => `
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">
              <div style="font-weight: 600;">${item.productName || ''}</div>
              ${item.description ? `<div style="font-size: 12px; color: #6b7280;">${item.description}</div>` : ''}
            </td>
            <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: center;">${item.quantity}</td>
            <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: right;">${currency} ${fmt(item.unitPrice)}</td>
            <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: right;">${item.taxRate || 0}%</td>
            <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: 600;">${currency} ${fmt(item.total)}</td>
          </tr>`).join('');

    const additionalChargeRows = (quote.additionalCharges || []).map((amount, i) => `
          <tr>
            <td colspan="4" style="padding: 4px 8px; text-align: right; color: #374151;">${quote.additionalChargesLabel?.[i] || 'Additional Charge'}:</td>
            <td style="padding: 4px 8px; text-align: right;">${currency} ${fmt(amount)}</td>
          </tr>`).join('');

    const termsAndConditions = addOpts?.terms
      ? `<div style="margin-top: 20px;">
           <h3 style="font-size: 14px; color: #1a2d4a; margin-bottom: 6px;">Terms &amp; Conditions</h3>
           <p style="font-size: 13px; color: #374151; white-space: pre-line;">${addOpts.terms}</p>
         </div>`
      : '';

    const notesSection = addOpts?.notes
      ? `<div style="margin-top: 12px;">
           <h3 style="font-size: 14px; color: #1a2d4a; margin-bottom: 6px;">Notes</h3>
           <p style="font-size: 13px; color: #374151; white-space: pre-line;">${addOpts.notes}</p>
         </div>`
      : '';

    const htmlBody = `
      <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto; border: 1px solid #e5e7eb; padding: 24px; border-radius: 8px;">
        <h2 style="color: #1a2d4a; margin-top: 0;">Quotation Details</h2>
        <p>Dear ${name},</p>
        <p>Please find the details of your quotation below:</p>
        <table style="width: 100%; border-collapse: collapse; margin-top: 16px;">
          <tr>
            <td style="padding: 8px 0; font-weight: bold; border-bottom: 1px solid #e5e7eb;">Quotation Number:</td>
            <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">${quote.quoteNumber}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; font-weight: bold; border-bottom: 1px solid #e5e7eb;">Valid Until:</td>
            <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">${formatApiDate(quote.validUntil)}</td>
          </tr>
        </table>

        <table style="width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 13px;">
          <thead>
            <tr style="background: #f8fafc;">
              <th style="text-align: left; padding: 8px; border-bottom: 2px solid #e5e7eb;">Item</th>
              <th style="text-align: center; padding: 8px; border-bottom: 2px solid #e5e7eb;">Qty</th>
              <th style="text-align: right; padding: 8px; border-bottom: 2px solid #e5e7eb;">Unit Price</th>
              <th style="text-align: right; padding: 8px; border-bottom: 2px solid #e5e7eb;">Tax</th>
              <th style="text-align: right; padding: 8px; border-bottom: 2px solid #e5e7eb;">Line Total</th>
            </tr>
          </thead>
          <tbody>${itemsRows}</tbody>
        </table>

        <table style="width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 13px;">
          <tr>
            <td colspan="4" style="padding: 4px 8px; text-align: right; color: #374151;">Subtotal:</td>
            <td style="padding: 4px 8px; text-align: right;">${currency} ${fmt(quote.subtotal)}</td>
          </tr>
          ${quote.discountAmount ? `<tr>
            <td colspan="4" style="padding: 4px 8px; text-align: right; color: #374151;">Discount:</td>
            <td style="padding: 4px 8px; text-align: right;">-${currency} ${fmt(quote.discountAmount)}</td>
          </tr>` : ''}
          <tr>
            <td colspan="4" style="padding: 4px 8px; text-align: right; color: #374151;">Tax:</td>
            <td style="padding: 4px 8px; text-align: right;">${currency} ${fmt(quote.taxAmount)}</td>
          </tr>
          ${additionalChargeRows}
          <tr>
            <td colspan="4" style="padding: 10px 8px; text-align: right; font-weight: bold; border-top: 2px solid #1a2d4a;">Total Amount:</td>
            <td style="padding: 10px 8px; text-align: right; font-weight: bold; border-top: 2px solid #1a2d4a; color: #2EB270;">${currency} ${fmt(quote.totalAmount)}</td>
          </tr>
        </table>

        ${termsAndConditions}
        ${notesSection}

        <p style="margin-top: 24px;">Thank you for your business!</p>
        <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
        <p style="font-size: 12px; color: #6b7280; text-align: center; margin-bottom: 0;">This is an automated notification from OptimaX.</p>
      </div>
    `;

    // Carry over any files already attached to the quote (Additional Options →
    // Attachments) — they already have a hosted fileUrl, so there's no need to
    // re-upload the client-generated PDF just to email it.
    const attachments: SalesEmailAttachment[] = (addOpts?.attachments || [])
      .filter((a: QuoteAttachments) => !!a.fileUrl)
      .map((a: QuoteAttachments) => ({
        fileName: a.fileName || `Quote-${quote.quoteNumber}.pdf`,
        fileUrl: a.fileUrl as string,
        size: a.size || 0,
        type: a.type || 'application/pdf'
      }));

    const payload: SendSalesEmailRequest = {
      documentType: 'QUOTE',
      documentId: quote.id,
      documentNumber: quote.quoteNumber,
      to: email,
      cc: [],
      bcc: [],
      subject: `Quotation ${quote.quoteNumber} from OptimaX`,
      message: htmlBody,
      attachments,
      sentBy: quote.merchantDetails?.email || 'system'
    };

    try {
      const response = await lastValueFrom(this.salesEmailService.send(payload));
      console.log('[QuoteFormComponent] Send response:', response);
      // A 2xx here only means the backend logged the send request — it doesn't
      // mean the email actually left the building. Trust `status`, not the HTTP call.
      if (response?.status === 'FAILED' || response?.status === 'BOUNCED') {
        this.messageService.add({ severity: 'error', summary: 'Email Not Delivered', detail: response.failureReason || `Delivery to ${email} failed.` });
      } else if (response?.status === 'PENDING') {
        this.messageService.add({ severity: 'info', summary: 'Email Queued', detail: `Quote queued for delivery to ${email}. It hasn't been confirmed sent yet.` });
      } else {
        this.messageService.add({ severity: 'success', summary: 'Email Sent', detail: `Quote sent successfully to ${email}` });
      }
    } catch (err) {
      console.error('[QuoteFormComponent] Failed to send quote email:', err);
      this.messageService.add({ severity: 'error', summary: 'Email Error', detail: 'Failed to send quote email.' });
    }
  }

  cancel(): void {
    const uuid = this.route.snapshot.paramMap.get('uuid');
    if (uuid) {
      this.router.navigate(['/sales-hub', uuid]);
    } else {
      this.router.navigate(['/sales-hub']);
    }
  }

  // Helper methods
  private formatDateForInput(date: Date): string {
    return toDateInputValue(date);
  }

  get today(): string {
    return new Date().toISOString().split('T')[0];
  }

  get minValidUntil(): string {
    const date = new Date();
    date.setDate(date.getDate() + 1);
    return date.toISOString().split('T')[0];
  }

  formatCurrency(amount: number): string {
    const currency = this.quoteForm.get('currency')?.value || 'NGN';
    return new Intl.NumberFormat('en-NG', { style: 'currency', currency }).format(amount);
  }

  getCurrencyLabel(code: string): string {
    const labels: Record<string, string> = {
      'NGN': 'Nigerian Naira (NGN, ₦)',
      'USD': 'US Dollar (USD, $)',
      'EUR': 'Euro (EUR, €)',
      'GBP': 'British Pound (GBP, £)'
    };
    return labels[code] || code;
  }

  getProductSku(productId: string): string {
    if (!productId) return 'N/A';
    const product = this.products.find(p => p.productId === productId || String(p.id) === productId);
    return product ? product.sku : 'N/A';
  }

  getTotalQuantity(): number {
    let total = 0;
    for (let i = 0; i < this.items.length; i++) {
      total += this.items.at(i).get('quantity')?.value || 0;
    }
    return total;
  }

  getTotalInWords(amount: number): string {
    if (amount === 0) return 'Zero Naira Only';
    
    const naira = Math.floor(amount);
    const kobo = Math.round((amount - naira) * 100);
    
    let result = '';
    if (naira > 0) {
      result += this.numberToWords(naira) + ' Naira';
    }
    if (kobo > 0) {
      result += (result ? ' ' : '') + this.numberToWords(kobo) + ' Kobo';
    }
    return result + ' Only';
  }

  private numberToWords(num: number): string {
    if (num === 0) return 'Zero';
    const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
      'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
    
    if (num < 20) return ones[num];
    if (num < 100) return tens[Math.floor(num / 10)] + (num % 10 ? ' ' + ones[num % 10] : '');
    if (num < 1000) return ones[Math.floor(num / 100)] + ' Hundred' + (num % 100 ? ' and ' + this.numberToWords(num % 100) : '');
    if (num < 1000000) return this.numberToWords(Math.floor(num / 1000)) + ' Thousand' + (num % 1000 ? ' ' + this.numberToWords(num % 1000) : '');
    return this.numberToWords(Math.floor(num / 1000000)) + ' Million' + (num % 1000000 ? ' ' + this.numberToWords(num % 1000000) : '');
  }

  isFieldInvalid(fieldName: string): boolean {
    const field = this.quoteForm.get(fieldName);
    return field ? (field.invalid && (field.dirty || field.touched)) : false;
  }


  // ============ UI Action Methods ============
  
  triggerLogoUpload(): void {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    fileInput.onchange = (e: any) => this.onLogoSelected(e);
    fileInput.click();
  }

  addDiscounts(): void {
    this.modalDiscountAmount = this.discountValue;
    this.modalDiscountType = this.discountType;
    this.showDiscountModal = true;
  }

  saveDiscountModal(): void {
    this.discountType = this.modalDiscountType;
    this.discountValue = this.modalDiscountType === 'PERCENTAGE' ? Math.min(this.modalDiscountAmount, 100) : this.modalDiscountAmount;
    this.calculateTotals();
    this.showDiscountModal = false;
  }

  addAdditionalCharges(): void {
    this.modalChargesList = this.additionalChargeItems.map(item => ({ ...item }));
    this.newChargeLabel = '';
    this.newChargeAmount = null;
    this.showChargesModal = true;
  }

  addChargeItemToModal(): void {
    if (!this.newChargeLabel.trim()) {
      this.messageService.add({ severity: 'warn', summary: 'Warning', detail: 'Please enter a label for the additional charge (e.g. Shipping, Handling).' });
      return;
    }
    if (this.newChargeAmount === null || this.newChargeAmount === undefined || this.newChargeAmount < 0) {
      this.messageService.add({ severity: 'warn', summary: 'Warning', detail: 'Please enter a valid charge amount.' });
      return;
    }
    this.modalChargesList.push({
      id: Math.floor(Math.random() * 1000000),
      label: this.newChargeLabel.trim(),
      amount: Number(this.newChargeAmount)
    });
    this.newChargeLabel = '';
    this.newChargeAmount = null;
  }

  removeChargeItemFromModal(index: number): void {
    this.modalChargesList.splice(index, 1);
  }

  get modalTotalCharges(): number {
    return this.modalChargesList.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  }

  saveChargesModal(): void {
    this.additionalChargeItems = this.modalChargesList.map(item => ({ ...item }));
    this.calculateTotals();
    this.showChargesModal = false;
  }

  editBilledBy(): void {
    this.billedByDraft = { ...this.billedBy };
    this.showBilledByModal = true;
  }

  saveBilledBy(): void {
    if (this.isSavingBilledBy) return;
    if (!this.billedByDraft.name || this.billedByDraft.name.trim().length === 0) {
      this.messageService.add({ severity: 'warn', summary: 'Warning', detail: 'Name is required for the sender.' });
      return;
    }

    this.isSavingBilledBy = true;
    const draft = this.billedByDraft;
    const payload: Partial<MerchantInfo> = {
      name: draft.name,
      companyName: draft.name,
      email: draft.email,
      phone: draft.phone,
      address: draft.address ? [draft.address] : [],
      bankDetails: {
        bankName: draft.bankName,
        accountName: draft.accountName,
        accountNumber: draft.accountNumber
      },
      website: draft.routingNumber || undefined,
      logoUrl: this.logoUrl ? [this.logoUrl] : undefined
    };

    const req = this.merchantInfoId
      ? this.salesService.updateMerchantInfo(this.merchantInfoId, payload)
      : this.salesService.createMerchantInfo({ ...payload, createdBy: Number(sessionStorage.getItem('userid')) || undefined });

    req.subscribe({
      next: (saved) => {
        this.merchantInfoId = saved.id;
        this.billedBy = { ...draft };
        this.isSavingBilledBy = false;
        this.showBilledByModal = false;
        this.messageService.add({ severity: 'success', summary: 'Saved', detail: 'Sender details updated.' });
        // Also keep the generic company profile in sync, as a fallback for forms/pages that read it.
        this.companyProfileService.updateBankDetails({
          bankName: this.billedBy.bankName,
          bankAccountName: this.billedBy.accountName,
          bankAccountNumber: this.billedBy.accountNumber
        });
        this.companyProfileService.updateContactDetails({
          email: this.billedBy.email,
          phone: this.billedBy.phone,
          address: this.billedBy.address
        });
      },
      error: (err) => {
        console.error('Error saving merchant info:', err);
        this.isSavingBilledBy = false;
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to save sender details. Please try again.' });
      }
    });
  }

  cancelBilledByEdit(): void {
    this.showBilledByModal = false;
  }

  getBilledByInitials(): string {
    if (!this.billedBy.name) return '??';
    const parts = this.billedBy.name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return parts[0].substring(0, 2).toUpperCase();
  }

  addDescription(index: number): void {
    const itemForm = this.items.at(index);
    const currentDesc = itemForm.get('description')?.value || '';
    const newDesc = prompt('Enter item description:', currentDesc);
    if (newDesc !== null) {
      itemForm.patchValue({ description: newDesc });
    }
  }

  addImage(index: number): void {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    fileInput.onchange = (e: any) => {
      const file = e.target.files?.[0];
      if (file) {
        this.messageService.add({ severity: 'success', summary: 'Success', detail: `Image "${file.name}" uploaded successfully for item.` });
      }
    };
    fileInput.click();
  }

  addUnit(index: number): void {
    const newUnit = prompt('Enter measurement unit (e.g. Kg, Box, Pack):', 'Each');
    if (newUnit) {
      this.messageService.add({ severity: 'info', summary: 'Notice', detail: `Measurement unit set to: ${newUnit}` });
    }
  }

  // Template selection handlers
  onTemplateSelected(template: QuoteTemplate | undefined): void {
    if (template) {
      this.selectedTemplate = template;
    }
  }

  getStepLabel(step: number): string {
    const labels = {
      1: 'Quote Details',
      2: 'Line Items',
      3: 'Template & Delivery'
    };
    return labels[step as keyof typeof labels] || '';
  }

  // Quick Client additions
  openNewCustomerModal(): void {
    this.showNewCustomerModal = true;
  }

  closeNewCustomerModal(): void {
    this.showNewCustomerModal = false;
    this.quickCustomerForm.reset({ savePermanently: true });
    while (this.quickCustomerBankAccounts.length) {
      this.quickCustomerBankAccounts.removeAt(0);
    }
  }

  get quickCustomerBankAccounts(): FormArray {
    return this.quickCustomerForm.get('bankAccounts') as FormArray;
  }

  addQuickCustomerBankAccount(): void {
    this.quickCustomerBankAccounts.push(this.fb.group({
      bankName: ['', Validators.required],
      accountName: ['', Validators.required],
      accountNumber: ['', [Validators.required, Validators.pattern(/^[0-9a-zA-Z\s\-]+$/)]],
      routingNumber: ['']
    }));
  }

  removeQuickCustomerBankAccount(index: number): void {
    this.quickCustomerBankAccounts.removeAt(index);
  }

  onQuickCustomerSubmit(): void {
    // Guards against duplicate customers being created when the request is slow and
    // the user clicks "Save Client" more than once before it resolves.
    if (this.isSavingCustomer) return;

    if (this.quickCustomerForm.invalid) {
      this.quickCustomerForm.markAllAsTouched();
      this.messageService.add({ severity: 'warn', summary: 'Warning', detail: 'Please fill in all required fields in the quick-add client form' });
      return;
    }

    this.isSavingCustomer = true;
    const val = this.quickCustomerForm.value;
    const newCust: any = {
      name: val.name,
      email: val.email,
      phone: val.phone,
      address: val.address,
      taxId: val.taxId || '',
      status: 'ACTIVE',
      bankAccounts: val.bankAccounts || [],
      createdAt: new Date(),
      totalSpent: 0,
      totalOrders: 0
    };

    if (val.savePermanently) {
      this.salesService.createCustomer(newCust).subscribe({
        next: (savedCust) => {
          this.customers = [...this.customers, savedCust];
          this.isSavingCustomer = false;
          this.showNewCustomerModal = false;
          this.quickCustomerForm.reset({ savePermanently: true });
          while (this.quickCustomerBankAccounts.length) {
            this.quickCustomerBankAccounts.removeAt(0);
          }
          this.messageService.add({ severity: 'success', summary: 'Client Created', detail: `"${savedCust.name}" has been added to your customers.` });
          setTimeout(() => {
            this.quoteForm.patchValue({ customerId: savedCust.customerId || String(savedCust.id) });
            this.onCustomerSelect(savedCust.customerId || String(savedCust.id));
          });
        },
        error: (err) => {
          console.error('Error saving client permanently:', err);
          this.isSavingCustomer = false;
          this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to save client permanently. Please try again.' });
        }
      });
    } else {
      // Temporary client
      const tempId = `TEMP-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
      const tempCust: Customer = {
        ...newCust,
        id: Math.floor(Math.random() * 1000000),
        customerId: tempId
      } as any;
      this.customers = [...this.customers, tempCust];
      this.isSavingCustomer = false;
      this.showNewCustomerModal = false;
      this.quickCustomerForm.reset({ savePermanently: true });
      while (this.quickCustomerBankAccounts.length) {
        this.quickCustomerBankAccounts.removeAt(0);
      }
      this.messageService.add({ severity: 'success', summary: 'Client Added', detail: `"${tempCust.name}" added for this quote.` });
      setTimeout(() => {
        this.quoteForm.patchValue({ customerId: tempId });
        this.onCustomerSelect(tempId);
      });
    }
  }

  isQuickFieldInvalid(fieldName: string): boolean {
    const field = this.quickCustomerForm.get(fieldName);
    return field ? (field.invalid && (field.dirty || field.touched)) : false;
  }
}
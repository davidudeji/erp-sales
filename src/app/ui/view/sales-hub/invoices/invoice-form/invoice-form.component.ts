import { Component, OnInit, OnDestroy, Input, Output, EventEmitter, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators, FormArray, AbstractControl, ValidatorFn } from '@angular/forms';
import { Router, RouterModule, ActivatedRoute } from '@angular/router';
import { Subject, takeUntil, forkJoin } from 'rxjs';
import { SalesService } from '../../../../service/sales/sales.service';
import { PdfGenerationService } from '../../../../service/procurement/pdf-generation.service';
import { SalesEmailService } from '../../../../service/sales/sales-email.service';
import { lastValueFrom } from 'rxjs';
import { Customer, Product, Invoice, InvoiceStatus, InvoiceItem, Quote, CustomerBankDetails, InvoiceAttachments, SendSalesEmailRequest, SalesEmailAttachment, MerchantInfo } from '../../../../domain/sales/sales.dto';
import { toDateInputValue, formatApiDate } from '../../../../service/sales/date.util';
import { BackButtonComponent } from '../../../../shared-component/view/back-button/back-button.component';
import { TemplateTypesComponent, QuoteTemplate } from '../../template-types/template-types.component';
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

export function dateAfterValidator(otherControlName: string): ValidatorFn {
  return (control: AbstractControl): { [key: string]: any } | null => {
    if (!control.value) {
      return null;
    }
    const parent = control.parent;
    if (!parent) return null;
    const otherControl = parent.get(otherControlName);
    if (!otherControl || !otherControl.value) return null;
    
    const d1 = new Date(otherControl.value);
    const d2 = new Date(control.value);
    d1.setHours(0,0,0,0);
    d2.setHours(0,0,0,0);
    
    return d2 < d1 ? { 'dateBefore': true } : null;
  };
}

@Component({
  selector: 'app-invoice-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, RouterModule, BackButtonComponent, TemplateTypesComponent, ToastModule],
  providers: [MessageService],
  templateUrl: './invoice-form.component.html',
  styleUrls: ['./invoice-form.component.scss']
})
export class InvoiceFormComponent implements OnInit, OnDestroy {
  @Input() editId?: string;
  @Input() fromQuoteId?: string;
  @Input() duplicateId?: string;
  @Output() saved = new EventEmitter<void>();
  @Output() cancelled = new EventEmitter<void>();


  get todayDateString(): string {
    return new Date().toISOString().substring(0, 10);
  }
  get today(): string {
    return this.todayDateString;
  }

  invoiceForm: FormGroup;
  isSubmitting = false;
  isLoading = false;
  isEditMode = false;
  invoiceId: string = '';
  quoteId: string = '';
  generatedInvoiceNumber: string = '';

  // ============ WIZARD STATE ============
  currentStep: 1 | 2 | 3 | 4 = 1;
  totalSteps = 4;
  selectedTemplate: QuoteTemplate | null = null;
  selectedAction: 'pdf' | 'email' | 'both' = 'pdf';

  get invoiceDataForTemplate(): any {
    return {
      customerId: this.invoiceForm.get('customerId')?.value,
      customerName: this.invoiceForm.get('customerName')?.value,
      customerEmail: this.customers.find(c => c.id === this.invoiceForm.get('customerId')?.value)?.email,
      currency: this.invoiceForm.get('currency')?.value,
      items: this.items.getRawValue().map((item: any) => ({
        ...item,
        total: item.total || 0,
        taxAmount: item.taxAmount || 0
      })),
      subtotal: this.subtotal,
      taxAmount: this.totalTax || this.taxAmount,
      discountAmount: this.discountAmount,
      additionalCharges: this.additionalCharges,
      additionalChargeItems: this.additionalChargeItems,
      totalAmount: this.grandTotal,
      notes: this.invoiceForm.get('notes')?.value,
      terms: this.invoiceForm.get('terms')?.value,
      issueDate: this.invoiceForm.get('issueDate')?.value,
      dueDate: this.invoiceForm.get('dueDate')?.value,
      logoUrl: this.logoUrl,
      selectedCustomerBank: this.invoiceForm.get('selectedCustomerBankIndex')?.value >= 0 ?
        this.selectedCustomerBankAccounts[this.invoiceForm.get('selectedCustomerBankIndex')?.value] :
        (this.isEditMode ? (this.loadedInvoiceSelectedCustomerBank || null) : null)
    };
  }

  showTerms = false;
  showNotes = false;
  showAdvanced = false;
  showSignature = false;

  // ============ STEP 2: PAYMENT TERMS STATE ============
  selectedPresetTerm: 'Net 15' | 'Net 30' | 'Net 60' | 'Due on Receipt' | 'Custom' = 'Net 30';
  paymentMode: 'ONE-OFF' | 'MONTHLY' = 'ONE-OFF';
  paymentMethod: any = 'BANK_TRANSFER';
  paymentPeriodDays: number = 30;
  numberOfInstallments: number = 1;
  depositPercentage: number = 0;
  lateFeeRate: number = 0;
  customTermsText: string = 'Payment is due within 30 days from invoice issue date. Late payments may be subject to a 1.5% monthly interest fee.';

  presetTermsList: { id: 'Net 15' | 'Net 30' | 'Net 60' | 'Due on Receipt' | 'Custom'; name: string; days: number; desc: string; icon: string }[] = [
    { id: 'Net 15', name: 'Net 15', days: 15, desc: 'Payment due within 15 days of issue', icon: 'fa-calendar-day' },
    { id: 'Net 30', name: 'Net 30', days: 30, desc: 'Standard terms — payment due in 30 days', icon: 'fa-calendar-week' },
    { id: 'Net 60', name: 'Net 60', days: 60, desc: 'Extended terms — payment due in 60 days', icon: 'fa-calendar-alt' },
    { id: 'Due on Receipt', name: 'Due on Receipt', days: 0, desc: 'Immediate payment required upon receipt', icon: 'fa-receipt' },
    { id: 'Custom', name: 'Custom Terms', days: 30, desc: 'Configure custom period and conditions', icon: 'fa-sliders-h' }
  ];

  paymentMethodsList: { value: string; label: string; icon: string }[] = [
    { value: 'BANK_TRANSFER', label: 'Bank Transfer (EFT)', icon: 'fa-university' },
    { value: 'CARD', label: 'Credit / Debit Card', icon: 'fa-credit-card' },
    { value: 'CASH', label: 'Cash Payment', icon: 'fa-money-bill-wave' },
    { value: 'CHEQUE', label: 'Cheque', icon: 'fa-money-check' },
    { value: 'POS', label: 'Point of Sale (POS)', icon: 'fa-cash-register' },
    { value: 'MOBILE_MONEY', label: 'Mobile Money', icon: 'fa-mobile-alt' }
  ];
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
  logoFileName = '';
  logoUrl = '';

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

  // Shipping Details data bindings
  showShippingDetails = false;
  shippingAddress = '';
  shippingMethod = '';
  shippingDate = '';

  // Discount & Additional charges
  additionalCharges = 0;

  // Data
  customers: Customer[] = [];
  products: Product[] = [];
  filteredProducts: Product[] = [];
  selectedCustomerBankAccounts: CustomerBankDetails[] = [];
  loadedInvoiceSelectedCustomerBank: CustomerBankDetails | null = null;
  quickCustomerForm!: FormGroup;

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

  // Billed By (Invoice From) editable data — persisted via the merchant-info endpoint.
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
    const custId = this.invoiceForm.get('customerId')?.value;
    return this.customers.find(c => c.customerId === custId || String(c.id) === custId);
  }

  // Currency
  currencies = ['NGN', 'USD', 'EUR', 'GBP'];

  // Tax settings
  taxRate = 0;

  // Calculated totals - THESE ARE THE PROPERTIES
  subtotal: number = 0;
  totalTax: number = 0;      // ← THIS WAS MISSING
  taxAmount: number = 0;
  discountAmount: number = 0;
  grandTotal: number = 0;

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
    private pdfGenerationService: PdfGenerationService,
    private salesEmailService: SalesEmailService,
    private cdr: ChangeDetectorRef,
    router: Router
  ) {
    this.router = router;
    this.invoiceForm = this.fb.group({
      customerId: ['', Validators.required],
      customerName: [''],
      invoiceNumber: [{ value: 'Auto-generated', disabled: true }],
      issueDate: [this.formatDateForInput(new Date()), Validators.required],
      dueDate: ['', [Validators.required, futureDateValidator(), dateAfterValidator('issueDate')]],
      currency: ['NGN', Validators.required],
      notes: [''],
      terms: [''],
      paymentTerms: ['Net 30'],
      items: this.fb.array([]),
      taxRate: [0],
      discountType: ['PERCENTAGE'],
      discountValue: [0],
      isRecurring: [false],
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
    this.invoiceId = this.editId || this.route.snapshot.paramMap.get('id') || '';
    this.quoteId = this.fromQuoteId || this.route.snapshot.queryParamMap.get('quoteId') || '';
    this.isEditMode = !!this.invoiceId;
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
          if (addr) { this.billedBy.address = addr; this.billedByDraft.address = addr; }
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
      products: this.salesService.getProducts({ page: 0, size: 100 })
    }).pipe(takeUntil(this.destroy$)).subscribe({
      next: (res: any) => {
        this.customers = res.customers?.data || [];
        this.products = res.products?.data || [];
        this.filteredProducts = this.products;
        this.isLoading = false;

        if (this.isEditMode) {
          this.loadInvoice();
        } else if (this.quoteId) {
          this.loadQuoteForInvoice();
          this.currentStep = 3;
        } else if (this.duplicateId) {
          this.loadInvoiceForDuplicate();
        } else {
          const customerId = this.route.snapshot.queryParamMap.get('customerId');
          if (customerId) {
            this.invoiceForm.patchValue({ customerId: customerId });
            this.onCustomerSelect(customerId);
          }
          if (!this.addLineItemFromCatalogQueryParams()) {
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
    // Auto-calculate due date based on payment terms
    this.invoiceForm.get('issueDate')?.valueChanges.subscribe(() => {
      this.updateDueDate();
    });

    this.invoiceForm.get('paymentTerms')?.valueChanges.subscribe(() => {
      this.updateDueDate();
    });

    // Calculate totals when items change
    this.invoiceForm.get('taxRate')?.valueChanges.subscribe(() => {
      this.calculateTotals();
    });

    this.invoiceForm.get('discountValue')?.valueChanges.subscribe(() => {
      this.calculateTotals();
    });

    this.invoiceForm.get('discountType')?.valueChanges.subscribe(() => {
      this.calculateTotals();
    });
  }

  private updateDueDate(): void {
    const issueDate = this.invoiceForm.get('issueDate')?.value;
    const paymentTerms = this.invoiceForm.get('paymentTerms')?.value;

    if (issueDate && paymentTerms) {
      const days = parseInt(paymentTerms.split(' ')[1]) || 30;
      const dueDate = new Date(issueDate);
      dueDate.setDate(dueDate.getDate() + days);
      this.invoiceForm.patchValue({ dueDate: this.formatDateForInput(dueDate) }, { emitEvent: false });
    }
  }

  // Form Arrays
  get items(): FormArray {
    return this.invoiceForm.get('items') as FormArray;
  }

  /** Coming from the (Inventory-backed) Product Catalog's "Create Invoice" button — it can't
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
    return true;
  }

  addLineItem(): void {
    const itemForm = this.fb.group({
      productId: [''],
      productName: ['', Validators.required],
      description: [''],
      quantity: [1, [Validators.required, Validators.min(1)]],
      unitPrice: [0, [Validators.required, Validators.min(0)]],
      taxRate: [0],
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

  get discountType(): 'PERCENTAGE' | 'FIXED' {
    return this.invoiceForm.get('discountType')?.value || 'PERCENTAGE';
  }
  set discountType(val: 'PERCENTAGE' | 'FIXED') {
    this.invoiceForm.patchValue({ discountType: val });
  }

  get discountValue(): number {
    return Number(this.invoiceForm.get('discountValue')?.value) || 0;
  }
  set discountValue(val: number) {
    this.invoiceForm.patchValue({ discountValue: val });
  }

  // ✅ SINGLE calculateTotals method - removed duplicate
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

    // Calculate discount
    const discountType = this.invoiceForm.get('discountType')?.value;
    const discountValue = this.invoiceForm.get('discountValue')?.value || 0;

    if (discountType === 'PERCENTAGE') {
      this.discountAmount = this.subtotal * (discountValue / 100);
    } else {
      this.discountAmount = discountValue;
    }

    // Sum itemized additional charges if available
    if (this.additionalChargeItems && this.additionalChargeItems.length > 0) {
      this.additionalCharges = this.additionalChargeItems.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    }

    // Calculate tax on after discount
    const taxRate = this.invoiceForm.get('taxRate')?.value || 0;
    const afterDiscount = this.subtotal - this.discountAmount;
    this.taxAmount = afterDiscount * (taxRate / 100);

    const finalTax = this.totalTax || this.taxAmount;
    this.grandTotal = afterDiscount + finalTax + this.additionalCharges;
  }

  // Product selection
  onProductSelect(index: number, productId: string): void {
    const product = this.products.find(p => p.productId === productId || String(p.id) === productId);
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
          productId: created.productId || String(created.id),
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
      productId: product.productId || String(product.id),
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
      this.invoiceForm.patchValue({ customerName: customer.name });
      this.selectedCustomerBankAccounts = customer.bankAccounts || [];
      if (this.selectedCustomerBankAccounts.length > 0) {
        // If we loaded a bank, try to match it first
        if (this.loadedInvoiceSelectedCustomerBank) {
          const index = this.selectedCustomerBankAccounts.findIndex(
            b => b.accountNumber === this.loadedInvoiceSelectedCustomerBank?.accountNumber && b.bankName === this.loadedInvoiceSelectedCustomerBank?.bankName
          );
          if (index >= 0) {
            this.invoiceForm.patchValue({ selectedCustomerBankIndex: index });
          } else {
            this.invoiceForm.patchValue({ selectedCustomerBankIndex: 0 });
          }
        } else {
          this.invoiceForm.patchValue({ selectedCustomerBankIndex: 0 });
        }
      } else {
        this.invoiceForm.patchValue({ selectedCustomerBankIndex: -1 });
      }
    } else {
      this.selectedCustomerBankAccounts = [];
      this.invoiceForm.patchValue({ selectedCustomerBankIndex: -1 });
    }
  }

  // Load data
  private loadCustomers(): void {
    this.salesService.getCustomers({ page: 0, size: 100 }).subscribe({
      next: (response: any) => {
        this.customers = response.data;
        const customerId = this.route.snapshot.queryParamMap.get('customerId');
        if (customerId) {
          this.invoiceForm.patchValue({ customerId: customerId });
          this.onCustomerSelect(customerId);
        }
      },
      error: (error: any) => {
        console.error('Error loading customers:', error);
        const customerId = this.route.snapshot.queryParamMap.get('customerId');
        if (customerId) {
          this.invoiceForm.patchValue({ customerId: customerId });
          this.onCustomerSelect(customerId);
        }
      }
    });
  }

  private loadProducts(): void {
    this.salesService.getProducts({ page: 0, size: 100 }).subscribe({
      next: (response: any) => {
        this.products = response.data;
        this.filteredProducts = this.products;
      },
      error: (error: any) => {
        console.error('Error loading products:', error);
      }
    });
  }

  private loadInvoice(): void {
    this.isLoading = true;
    this.salesService.getInvoiceById(this.invoiceId).subscribe({
      next: (invoice: Invoice | null) => {
        if (invoice) {
          this.populateForm(invoice);
        }
        this.isLoading = false;
      },
      error: (error: any) => {
        console.error('Error loading invoice:', error);
        this.isLoading = false;
      }
    });
  }

  // Copy an existing invoice's details into this (still-new) form so the user can
  // review/edit before it is saved and sent as a brand-new invoice.
  private loadInvoiceForDuplicate(): void {
    // The list screen already has the full invoice in memory and hands it over via
    // router state, so the common "duplicate from the list" path is instant and
    // needs no round-trip. Only hit the network as a fallback — e.g. a deep link,
    // a page refresh, or the state having been lost some other way.
    const passedInvoice = (history.state as any)?.duplicateSource as Invoice | undefined;
    if (passedInvoice && String(passedInvoice.id) === this.duplicateId) {
      this.applyDuplicateSource(passedInvoice);
      return;
    }

    this.isLoading = true;
    this.salesService.getInvoiceById(this.duplicateId!).subscribe({
      next: (invoice: Invoice | null) => {
        if (invoice) {
          this.applyDuplicateSource(invoice);
        }
        this.isLoading = false;
      },
      error: (error: any) => {
        console.error('Error loading invoice to duplicate:', error);
        this.isLoading = false;
      }
    });
  }

  private applyDuplicateSource(invoice: Invoice): void {
    this.populateForm(invoice);

    // Don't inherit the source invoice's link back to a quote - this is a
    // fresh, independent invoice, so it shouldn't affect that quote's status.
    this.quoteId = '';

    // Refresh the dates rather than carrying over the original invoice's.
    const today = new Date();
    const defaultDueDate = new Date();
    defaultDueDate.setDate(defaultDueDate.getDate() + 30);
    this.invoiceForm.patchValue({
      issueDate: this.formatDateForInput(today),
      dueDate: this.formatDateForInput(defaultDueDate)
    });
  }

  private loadQuoteForInvoice(): void {
    this.isLoading = true;
    this.salesService.getQuoteById(this.quoteId).subscribe({
      next: (quote: Quote | null) => {
        if (quote) {
          this.populateFromQuote(quote);
          this.validateStep2();
        }
        this.isLoading = false;
      },
      error: (error: any) => {
        console.error('Error loading quote:', error);
        this.isLoading = false;
      }
    });
  }

  private populateFromQuote(quote: Quote): void {
    const defaultDueDate = new Date();
    defaultDueDate.setDate(defaultDueDate.getDate() + 30);

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

    const addOpts = Array.isArray(quote.additionalOptions) ? quote.additionalOptions[0] : (quote.additionalOptions as any);

    this.invoiceForm.patchValue({
      customerId: custId,
      customerName: custName,
      currency: quote.currency,
      notes: addOpts?.notes || '',
      terms: addOpts?.terms || '',
      paymentTerms: addOpts?.terms || 'Net 30',
      dueDate: this.formatDateForInput(defaultDueDate)
    });

    this.logoUrl = quote.logoUrl?.[0] || '';
    this.logoFileName = quote.logoUrl?.[0] ? 'Saved Logo' : '';

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

    // Add items from quote
    quote.items.forEach((item: any) => {
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

  private populateForm(invoice: Invoice): void {
    this.quoteId = invoice.quoteId || '';
    this.loadedInvoiceSelectedCustomerBank = invoice.selectedCustomerBank || null;
    
    let custId = '';
    if (invoice.customerId) {
      if (typeof invoice.customerId === 'object') {
        custId = invoice.customerId.customerId || String(invoice.customerId.id || '');
      } else {
        custId = String(invoice.customerId);
      }
    }
    
    let custName = '';
    if (invoice.customerName) {
      if (typeof invoice.customerName === 'object') {
        custName = invoice.customerName.name || String(invoice.customerName);
      } else {
        custName = String(invoice.customerName);
      }
    } else if (typeof invoice.customerId === 'object' && invoice.customerId) {
      custName = invoice.customerId.name || '';
    }

    this.invoiceForm.patchValue({
      customerId: custId,
      customerName: custName,
      issueDate: this.formatDateForInput(invoice.issueDate),
      dueDate: this.formatDateForInput(invoice.dueDate),
      currency: invoice.currency,
      notes: invoice.notes || '',
      terms: (invoice as any).terms || '',
      paymentTerms: (invoice.paymentTerms as any)?.label || 'Net 30'
    });
    this.onCustomerSelect(custId);

    if (invoice.merchantDetails) {
      this.billedBy = {
        name: invoice.merchantDetails.name || invoice.merchantDetails.companyName || '',
        email: invoice.merchantDetails.email || '',
        phone: invoice.merchantDetails.phone || '',
        address: Array.isArray(invoice.merchantDetails.address) ? invoice.merchantDetails.address.join(', ') : (invoice.merchantDetails.address || ''),
        bankName: invoice.merchantDetails.bankDetails?.bankName || '',
        accountName: invoice.merchantDetails.bankDetails?.accountName || '',
        accountNumber: invoice.merchantDetails.bankDetails?.accountNumber || '',
        routingNumber: invoice.merchantDetails.website || ''
      };
      this.billedByDraft = { ...this.billedBy };
    }

    this.logoUrl = invoice.logoUrl || '';
    this.logoFileName = invoice.logoUrl ? 'Saved Logo' : '';

    if (Array.isArray(invoice.additionalCharges)) {
      const labels = invoice.additionalChargesLabel || [];
      this.additionalChargeItems = invoice.additionalCharges.map((amt, idx) => ({
        id: idx + 1,
        label: labels[idx] || `Charge #${idx + 1}`,
        amount: Number(amt) || 0
      }));
    } else if (typeof (invoice as any).additionalCharges === 'number' && (invoice as any).additionalCharges > 0) {
      this.additionalChargeItems = [{
        id: 1,
        label: 'Additional Charge',
        amount: Number((invoice as any).additionalCharges)
      }];
    }

    // Clear existing items
    while (this.items.length) {
      this.items.removeAt(0);
    }

    // Add items from invoice
    invoice.items.forEach(item => {
      this.addLineItem();
      const index = this.items.length - 1;
      const itemForm = this.items.at(index);
      
      const matchingProduct = this.products.find(
        p => p.name.toLowerCase() === item.productName.toLowerCase()
      );
      const pId = matchingProduct ? matchingProduct.id : '';

      itemForm.patchValue({
        productId: pId,
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

  // Submit
  onSubmit(): void {
    if (this.invoiceForm.invalid) {
      this.invoiceForm.markAllAsTouched();
      this.logInvalidControls(this.invoiceForm);
      this.messageService.add({ severity: 'warn', summary: 'Warning', detail: 'Please fill in all required fields. Check console for details.' });
      return;
    }

    if (this.items.length === 0) {
      this.messageService.add({ severity: 'warn', summary: 'Warning', detail: 'Please add at least one item to the invoice' });
      return;
    }

    if (this.shippingDate) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const inputDate = new Date(this.shippingDate);
      inputDate.setHours(0, 0, 0, 0);
      if (inputDate < today) {
        this.messageService.add({ severity: 'warn', summary: 'Warning', detail: 'Shipping date cannot be in the past.' });
        return;
      }
    }

    this.isSubmitting = true;

    const formValue = this.invoiceForm.getRawValue();

    // Build items matching InvoiceItemDTO exactly
    const items = this.items.controls.map(ctrl => {
      const raw = (ctrl as any).getRawValue();
      return {
        productName: raw.productName || '',
        description: raw.description || '',
        quantity: Number(raw.quantity) || 1,
        unitPrice: Number(raw.unitPrice) || 0,
        total: Number(raw.total) || 0
      };
    });

    const customerObj = this.customers.find(c =>
      c.customerId === formValue.customerId || String(c.id) === String(formValue.customerId)
    ) || { id: null, name: formValue.customerName || '' } as any;

    const selectedBankIdx = formValue.selectedCustomerBankIndex;
    let selectedCustomerBankId: number | null = null;
    if (selectedBankIdx != null && selectedBankIdx >= 0 && selectedBankIdx < this.selectedCustomerBankAccounts.length) {
      const bank = this.selectedCustomerBankAccounts[selectedBankIdx] as any;
      selectedCustomerBankId = bank.id || null;
    } else if (this.isEditMode && this.loadedInvoiceSelectedCustomerBank) {
      const bank = this.loadedInvoiceSelectedCustomerBank as any;
      selectedCustomerBankId = bank.id || null;
    }

    // Payload matches InvoiceDTO exactly — no extra fields
    const invoiceData: any = {
      customerId: customerObj.id ? Number(customerObj.id) : null,
      currency: formValue.currency || 'NGN',
      issueDate: formValue.issueDate ? new Date(formValue.issueDate).toISOString() : new Date().toISOString(),
      dueDate: formValue.dueDate ? new Date(formValue.dueDate).toISOString() : null,
      notes: formValue.notes || '',
      terms: formValue.terms || '',
      paymentTerms: formValue.paymentTerms || 'Net 30',
      logoUrl: this.logoUrl || null,
      selectedCustomerBankId: selectedCustomerBankId,
      items: items,
      subtotal: this.subtotal,
      taxAmount: this.taxAmount,
      discountAmount: this.discountAmount,
      totalAmount: this.grandTotal,
      additionalCharges: this.additionalChargeItems.map(c => c.amount),
      additionalChargesLabel: this.additionalChargeItems.map(c => c.label),
      amountPaid: 0,
      balanceDue: this.grandTotal,
      status: 'DRAFT' as InvoiceStatus,
      quoteId: this.quoteId ? Number(this.quoteId) : null
    };

    let request;
    if (this.isEditMode) {
      request = this.salesService.updateInvoice(this.invoiceId, invoiceData);
    } else {
      request = this.salesService.createInvoice(invoiceData);
    }

    request.subscribe({
      next: async (response: Invoice) => {
        this.isSubmitting = false;
        await this.handleDeliveryAction(response, this.selectedAction);

        if (response.status === 'SENT' && response.quoteId) {
          this.salesService.updateQuote(response.quoteId, { status: 'CONVERTED' }).subscribe({
            next: () => console.log(`Quote ${response.quoteId} marked as CONVERTED`),
            error: (err) => console.error('Error converting quote:', err)
          });
        }

        this.messageService.add({ severity: 'success', summary: 'Success', detail: this.isEditMode ? 'Invoice updated successfully!' : 'Invoice created successfully!' });
        const uuid = this.route.snapshot.paramMap.get('uuid');
        if (uuid) {
          this.router.navigate(['/invoices', response.id, uuid]);
        } else {
          this.router.navigate(['/invoices', response.id]);
        }
      },
      error: (error: any) => {
        console.error('Error saving invoice:', error);
        this.isSubmitting = false;
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to save invoice. Please try again.' });
      }
    });
  }

  isSavingDraft = false;

  saveDraft(): void {
    if (this.isSavingDraft || this.isSubmitting) return;
    this.isSavingDraft = true;
    const formValue = this.invoiceForm.getRawValue();

    const items = this.items.controls.map(ctrl => {
      const raw = (ctrl as any).getRawValue();
      return {
        productName: raw.productName || 'Draft Item',
        description: raw.description || '',
        quantity: Number(raw.quantity) || 1,
        unitPrice: Number(raw.unitPrice) || 0,
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
      issueDate: formValue.issueDate ? new Date(formValue.issueDate).toISOString() : new Date().toISOString(),
      dueDate: formValue.dueDate ? new Date(formValue.dueDate).toISOString() : null,
      notes: formValue.notes || '',
      terms: formValue.terms || '',
      paymentTerms: formValue.paymentTerms || 'Net 30',
      logoUrl: this.logoUrl || null,
      selectedCustomerBankId,
      items: items.length ? items : [{ productName: 'Draft', quantity: 1, unitPrice: 0, total: 0 }],
      subtotal: this.subtotal,
      taxAmount: this.taxAmount,
      discountAmount: this.discountAmount,
      totalAmount: this.grandTotal,
      additionalCharges: this.additionalChargeItems.map(c => c.amount),
      additionalChargesLabel: this.additionalChargeItems.map(c => c.label),
      amountPaid: 0,
      balanceDue: this.grandTotal,
      status: 'DRAFT' as InvoiceStatus,
      quoteId: this.quoteId ? Number(this.quoteId) : null
    };

    const req = this.isEditMode
      ? this.salesService.updateInvoice(this.invoiceId, draftData)
      : this.salesService.createInvoice(draftData);

    req.pipe(takeUntil(this.destroy$)).subscribe({
      next: (saved: Invoice) => {
        this.isSavingDraft = false;
        if (!this.isEditMode && (saved as any).id) {
          this.invoiceId = String((saved as any).id);
          this.isEditMode = true;
        }
        this.messageService.add({ severity: 'success', summary: 'Draft Saved', detail: 'Invoice saved as draft.' });
      },
      error: () => {
        this.isSavingDraft = false;
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to save draft.' });
      }
    });
  }

  cancel(): void {
    const uuid = this.route.snapshot.paramMap.get('uuid');
    if (uuid) {
      this.router.navigate(['/sales-hub', uuid]);
    } else {
      this.router.navigate(['/sales-hub']);
    }
  }

  navigateToInvoices(): void {
    this.router.navigate(['/sales-hub']);
  }

  // Helper methods
  private formatDateForInput(date: Date): string {
    return toDateInputValue(date);
  }

  formatCurrency(amount: number, customCurrency?: string): string {
    const currency = customCurrency || this.invoiceForm.get('currency')?.value || 'NGN';
    const symbol = currency === 'USD' ? '$' : currency === 'EUR' ? '€' : currency === 'GBP' ? '£' : '₦';
    return `${symbol}${(amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  isFieldInvalid(fieldName: string): boolean {
    const field = this.invoiceForm.get(fieldName);
    return field ? (field.invalid && (field.dirty || field.touched)) : false;
  }

  getTotalQuantity(): number {
    let total = 0;
    for (let i = 0; i < this.items.length; i++) {
      total += this.items.at(i).get('quantity')?.value || 0;
    }
    return total;
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

  triggerLogoUpload(): void {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    fileInput.onchange = (e: any) => this.onLogoSelected(e);
    fileInput.click();
  }

  addNewGroup(): void {}

  addShippingDetails(): void {
    this.showShippingDetails = !this.showShippingDetails;
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

  // ============ STEP 2 PAYMENT TERMS HELPERS ============
  selectPresetTerm(preset: 'Net 15' | 'Net 30' | 'Net 60' | 'Due on Receipt' | 'Custom'): void {
    this.selectedPresetTerm = preset;
    const issueDateVal = this.invoiceForm.get('issueDate')?.value || this.formatDateForInput(new Date());
    const baseDate = new Date(issueDateVal);

    let days = 30;
    switch (preset) {
      case 'Net 15': days = 15; break;
      case 'Net 30': days = 30; break;
      case 'Net 60': days = 60; break;
      case 'Due on Receipt': days = 0; break;
      case 'Custom': days = this.paymentPeriodDays || 30; break;
    }

    this.paymentPeriodDays = days;
    const dueDate = new Date(baseDate);
    dueDate.setDate(dueDate.getDate() + days);

    const defaultTermsMap: Record<string, string> = {
      'Net 15': 'Payment is due within 15 days of invoice date.',
      'Net 30': 'Payment is due within 30 days of invoice date. Thank you for your business!',
      'Net 60': 'Payment is due within 60 days of invoice date.',
      'Due on Receipt': 'Payment is due immediately upon receipt of this invoice.',
      'Custom': this.customTermsText || `Payment is due within ${days} days.`
    };

    this.customTermsText = defaultTermsMap[preset] || defaultTermsMap['Net 30'];

    const termLabel = preset === 'Custom' ? `Custom (${days} days)` : preset;
    this.invoiceForm.patchValue({
      paymentTerms: termLabel,
      dueDate: this.formatDateForInput(dueDate),
      terms: this.customTermsText
    });
  }

  onCustomDaysChange(days: number): void {
    this.paymentPeriodDays = days || 0;
    const issueDateVal = this.invoiceForm.get('issueDate')?.value || this.formatDateForInput(new Date());
    const baseDate = new Date(issueDateVal);
    const dueDate = new Date(baseDate);
    dueDate.setDate(dueDate.getDate() + (days || 0));

    this.invoiceForm.patchValue({
      paymentTerms: `Custom (${days} days)`,
      dueDate: this.formatDateForInput(dueDate)
    });
  }

  get installmentSchedule(): { number: number; amount: number; dueDate: string }[] {
    if (this.paymentMode === 'ONE-OFF' || this.numberOfInstallments <= 1) return [];
    const total = this.grandTotal || 0;
    const count = this.numberOfInstallments || 1;
    const perInstallment = total / count;
    const issueDateVal = this.invoiceForm.get('issueDate')?.value || this.formatDateForInput(new Date());

    const schedule = [];
    for (let i = 1; i <= count; i++) {
      const dt = new Date(issueDateVal);
      dt.setMonth(dt.getMonth() + (i - 1));
      schedule.push({
        number: i,
        amount: perInstallment,
        dueDate: this.formatDateForInput(dt)
      });
    }
    return schedule;
  }

  get calculatedDepositAmount(): number {
    return (this.grandTotal || 0) * ((this.depositPercentage || 0) / 100);
  }

  // ============ WIZARD NAVIGATION ============
  goToStep(step: 1 | 2 | 3 | 4): void {
    if (step > this.currentStep) {
      if (this.currentStep === 1 && !this.validateStep1()) return;
      if (this.currentStep === 2 && !this.validateStep2()) return;
      if (this.currentStep === 3 && !this.validateStep3()) return;
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
    } else if (this.currentStep === 3) {
      if (this.validateStep3()) {
        this.currentStep = 4;
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }
  }

  prevStep(): void {
    if (this.currentStep > 1) {
      this.currentStep = (this.currentStep - 1) as 1 | 2 | 3 | 4;
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
      this.nextStep();
    } else if (this.currentStep === 4) {
      this.onSubmit();
    }
  }

  // ============ STEP VALIDATION ============
  private validateStep1(): boolean {
    console.log('Validating Step 1 (Invoice Details & Line Items)...');

    if (!this.invoiceForm.get('customerId')?.value) {
      this.messageService.add({ severity: 'warn', summary: 'Warning', detail: 'Please select a customer' });
      return false;
    }

    if (!this.invoiceForm.get('issueDate')?.value) {
      this.messageService.add({ severity: 'warn', summary: 'Warning', detail: 'Please select an invoice date' });
      return false;
    }

    if (!this.invoiceForm.get('dueDate')?.value) {
      this.messageService.add({ severity: 'warn', summary: 'Warning', detail: 'Please select a due date' });
      return false;
    }

    if (this.invoiceForm.get('dueDate')?.invalid) {
      const errors = this.invoiceForm.get('dueDate')?.errors;
      if (errors?.['pastDate']) {
        this.messageService.add({ severity: 'warn', summary: 'Warning', detail: 'Due date cannot be in the past' });
        return false;
      }
      if (errors?.['dateBefore']) {
        this.messageService.add({ severity: 'warn', summary: 'Warning', detail: 'Due date cannot be before issue date' });
        return false;
      }
    }

    if (this.items.length === 0) {
      this.messageService.add({ severity: 'warn', summary: 'Warning', detail: 'Please add at least one item to the invoice' });
      return false;
    }

    for (let i = 0; i < this.items.length; i++) {
      const item = this.items.at(i);

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
    if (this.paymentMode === 'MONTHLY' && (!this.numberOfInstallments || this.numberOfInstallments < 1)) {
      this.messageService.add({ severity: 'warn', summary: 'Warning', detail: 'Please enter a valid number of installments (min 1)' });
      return false;
    }
    return true;
  }

  private validateStep3(): boolean {
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

  onTemplateSelected(template: QuoteTemplate | undefined): void {
    if (template) {
      this.selectedTemplate = template;
    }
  }

  onCreateAction(event: { action: 'pdf' | 'email' | 'both' }): void {
    this.selectedAction = event.action;
    this.onSubmit();
  }

  // ============ DELIVERY ACTIONS ============
  // ============ DELIVERY ACTIONS ============
  /**
   * Tries the server PDF endpoint, falls back to client-side generation on failure, and
   * downloads whichever succeeds. Never throws — a PDF failure shouldn't block email
   * sending or navigation.
   */
  private async downloadInvoicePdf(invoice: Invoice): Promise<void> {
    try {
      const blob = await lastValueFrom(this.pdfGenerationService.generatePdf({
        documentType: 'INVOICE',
        documentId: String(invoice.id),
        documentNumber: invoice.invoiceNumber,
        tenantId: 'optimax',
        data: invoice
      }));
      this.pdfGenerationService.downloadBlob(blob as any, `Invoice-${invoice.invoiceNumber}.pdf`);
    } catch (err) {
      console.warn('[InvoiceFormComponent] Server PDF failed, using client fallback:', err);
      try {
        const clientBlob = await this.generateInvoicePDF(invoice);
        this.pdfGenerationService.downloadBlob(clientBlob, `Invoice-${invoice.invoiceNumber}.pdf`);
      } catch (e) {
        console.error('Client PDF generation failed:', e);
      }
    }
  }

  private async handleDeliveryAction(invoice: Invoice, action: 'pdf' | 'email' | 'both'): Promise<void> {
    try {
      // Awaited in sequence, not fired-and-forgotten: the caller navigates away as soon as
      // this promise resolves, which tears down this component (and the step-1 preview
      // element the client-side PDF fallback needs) — racing ahead of the PDF silently
      // killed it whenever the server PDF call failed during "PDF + Email".
      if (action === 'pdf' || action === 'both') {
        await this.downloadInvoicePdf(invoice);
      }

      if (action === 'email' || action === 'both') {
        await this.sendInvoiceEmail(invoice);
      }
    } catch (error) {
      console.error('Error in delivery action:', error);
      this.messageService.add({ severity: 'warn', summary: 'Warning', detail: 'There was an issue with the delivery. Please try again.' });
    }
  }

  private async generateInvoicePDF(invoice: Invoice): Promise<Blob> {
    this.generatedInvoiceNumber = invoice.invoiceNumber;

    // The preview element lives only on step 1 — switch there if needed. Submission happens
    // on step 4, so without this the element is never in the DOM and this always throws.
    const prevStep = this.currentStep;
    if (this.currentStep !== 1) {
      this.currentStep = 1;
      this.cdr.detectChanges();
    }

    // Allow small delay for Angular to bind the new invoice number to the DOM
    await new Promise(resolve => setTimeout(resolve, 100));

    const element = document.getElementById('invoice-preview-document');
    if (!element) {
      this.currentStep = prevStep;
      this.generatedInvoiceNumber = '';
      throw new Error('Preview document element not found');
    }

    // Clone into unconstrained off-screen container so html2canvas captures
    // the full scrollable content, not just the overflow:auto visible slice.
    const clone = element.cloneNode(true) as HTMLElement;
    clone.style.position = 'fixed';
    clone.style.top = '-99999px';
    clone.style.left = '0';
    clone.style.width = element.offsetWidth + 'px';
    clone.style.height = 'auto';
    clone.style.overflow = 'visible';
    clone.style.maxHeight = 'none';
    document.body.appendChild(clone);

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

    this.currentStep = prevStep;
    this.generatedInvoiceNumber = '';
    this.cdr.detectChanges();

    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageWidth = 210;
    const pageHeight = 297;
    const imgWidth = pageWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

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

  private async sendInvoiceEmail(invoice: Invoice): Promise<void> {
    const customerId = this.invoiceForm.get('customerId')?.value;
    const customerObj = this.customers.find(c =>
      c.customerId === customerId || String(c.id) === String(customerId)
    );
    const email = customerObj?.email || (invoice.customerName as any)?.email || (invoice.customerId as any)?.email || '';
    const name = customerObj?.name || (invoice.customerName as any)?.name || 'Customer';

    if (!email) {
      console.warn('Cannot send email, customer email is missing');
      this.messageService.add({ severity: 'warn', summary: 'Missing Email', detail: 'Could not find recipient email address' });
      return;
    }

    const addOpts = Array.isArray(invoice.additionalOptions) ? invoice.additionalOptions[0] : (invoice.additionalOptions as any);
    const currency = invoice.currency || 'NGN';
    const fmt = (n: number) => (n || 0).toLocaleString('en-NG');

    const itemsRows = (invoice.items || []).map(item => `
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

    const additionalChargeRows = (invoice.additionalCharges || []).map((amount, i) => `
          <tr>
            <td colspan="4" style="padding: 4px 8px; text-align: right; color: #374151;">${invoice.additionalChargesLabel?.[i] || 'Additional Charge'}:</td>
            <td style="padding: 4px 8px; text-align: right;">${currency} ${fmt(amount)}</td>
          </tr>`).join('');

    const termsAndConditions = addOpts?.terms
      ? `<div style="margin-top: 20px;">
           <h3 style="font-size: 14px; color: #1a2d4a; margin-bottom: 6px;">Terms &amp; Conditions</h3>
           <p style="font-size: 13px; color: #374151; white-space: pre-line;">${addOpts.terms}</p>
         </div>`
      : '';

    const invoiceNotes = invoice.notes || addOpts?.notes;
    const notesSection = invoiceNotes
      ? `<div style="margin-top: 12px;">
           <h3 style="font-size: 14px; color: #1a2d4a; margin-bottom: 6px;">Notes</h3>
           <p style="font-size: 13px; color: #374151; white-space: pre-line;">${invoiceNotes}</p>
         </div>`
      : '';

    const htmlBody = `
      <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto; border: 1px solid #e5e7eb; padding: 24px; border-radius: 8px;">
        <h2 style="color: #1a2d4a; margin-top: 0;">Invoice Details</h2>
        <p>Dear ${name},</p>
        <p>Please find the details of your invoice below:</p>
        <table style="width: 100%; border-collapse: collapse; margin-top: 16px;">
          <tr>
            <td style="padding: 8px 0; font-weight: bold; border-bottom: 1px solid #e5e7eb;">Invoice Number:</td>
            <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">${invoice.invoiceNumber}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; font-weight: bold; border-bottom: 1px solid #e5e7eb;">Due Date:</td>
            <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">${formatApiDate(invoice.dueDate)}</td>
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
            <td style="padding: 4px 8px; text-align: right;">${currency} ${fmt(invoice.subtotal)}</td>
          </tr>
          ${invoice.discountAmount ? `<tr>
            <td colspan="4" style="padding: 4px 8px; text-align: right; color: #374151;">Discount:</td>
            <td style="padding: 4px 8px; text-align: right;">-${currency} ${fmt(invoice.discountAmount)}</td>
          </tr>` : ''}
          <tr>
            <td colspan="4" style="padding: 4px 8px; text-align: right; color: #374151;">Tax:</td>
            <td style="padding: 4px 8px; text-align: right;">${currency} ${fmt(invoice.taxAmount)}</td>
          </tr>
          ${additionalChargeRows}
          <tr>
            <td colspan="4" style="padding: 10px 8px; text-align: right; font-weight: bold; border-top: 2px solid #1a2d4a;">Total Amount:</td>
            <td style="padding: 10px 8px; text-align: right; font-weight: bold; border-top: 2px solid #1a2d4a; color: #2EB270;">${currency} ${fmt(invoice.totalAmount)}</td>
          </tr>
        </table>

        ${termsAndConditions}
        ${notesSection}

        <p style="margin-top: 24px;">Thank you for your business!</p>
        <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
        <p style="font-size: 12px; color: #6b7280; text-align: center; margin-bottom: 0;">This is an automated notification from OptimaX.</p>
      </div>
    `;

    // Carry over any files already attached to the invoice (Additional Options →
    // Attachments) — they already have a hosted fileUrl, so there's no need to
    // re-upload the client-generated PDF just to email it.
    const attachments: SalesEmailAttachment[] = (addOpts?.attachments || [])
      .filter((a: InvoiceAttachments) => !!a.fileUrl)
      .map((a: InvoiceAttachments) => ({
        fileName: a.fileName || `Invoice-${invoice.invoiceNumber}.pdf`,
        fileUrl: a.fileUrl as string,
        size: a.size || 0,
        type: a.type || 'application/pdf'
      }));

    const payload: SendSalesEmailRequest = {
      documentType: 'INVOICE',
      documentId: invoice.id,
      documentNumber: invoice.invoiceNumber,
      to: email,
      cc: [],
      bcc: [],
      subject: `Invoice ${invoice.invoiceNumber} from OptimaX`,
      message: htmlBody,
      attachments,
      sentBy: invoice.merchantDetails?.email || 'system'
    };

    try {
      const response = await lastValueFrom(this.salesEmailService.send(payload));
      console.log('[InvoiceFormComponent] Send response:', response);
      // A 2xx here only means the backend logged the send request — it doesn't
      // mean the email actually left the building. Trust `status`, not the HTTP call.
      if (response?.status === 'FAILED' || response?.status === 'BOUNCED') {
        this.messageService.add({ severity: 'error', summary: 'Email Not Delivered', detail: response.failureReason || `Delivery to ${email} failed.` });
      } else if (response?.status === 'PENDING') {
        this.messageService.add({ severity: 'info', summary: 'Email Queued', detail: `Invoice queued for delivery to ${email}. It hasn't been confirmed sent yet.` });
      } else {
        this.messageService.add({ severity: 'success', summary: 'Email Sent', detail: `Invoice sent successfully to ${email}` });
      }
    } catch (err) {
      console.error('[InvoiceFormComponent] Failed to send invoice email:', err);
      this.messageService.add({ severity: 'error', summary: 'Email Error', detail: 'Failed to send invoice email.' });
    }
  }

  getProductSku(productId: string): string {
    if (!productId) return 'N/A';
    const product = this.products.find(p => p.productId === productId || String(p.id) === productId);
    return product ? product.sku : 'N/A';
  }

  getStepLabel(step: number): string {
    const labels = {
      1: 'Invoice Details',
      2: 'Template Design',
      3: 'Preview & Delivery'
    };
    return labels[step as keyof typeof labels] || '';
  }

  private logInvalidControls(formGroup: FormGroup | FormArray): void {
    Object.keys(formGroup.controls).forEach(key => {
      const control = formGroup.get(key);
      if (control?.invalid) {
        if (control instanceof FormGroup || control instanceof FormArray) {
          console.warn(`Invalid Form group/array: ${key}`);
          this.logInvalidControls(control);
        } else {
          console.warn(`Invalid Control: ${key}`, control.errors);
        }
      }
    });
  }

  // Quick Customer helpers & submit
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
            this.invoiceForm.patchValue({ customerId: savedCust.customerId || String(savedCust.id) });
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
      // Temporary client (Invoice Only)
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
      this.messageService.add({ severity: 'success', summary: 'Client Added', detail: `"${tempCust.name}" added for this invoice.` });
      setTimeout(() => {
        this.invoiceForm.patchValue({ customerId: tempId });
        this.onCustomerSelect(tempId);
      });
    }
  }

  isQuickFieldInvalid(fieldName: string): boolean {
    const field = this.quickCustomerForm.get(fieldName);
    return field ? (field.invalid && (field.dirty || field.touched)) : false;
  }
}
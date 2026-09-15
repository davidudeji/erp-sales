import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators, FormArray } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil, take } from 'rxjs/operators';

import { VendorRegistrationService } from '../../../service/vendor-portal/vendor-registration.service';
import {
  BusinessType, BusinessSize, OwnershipType, SupplyCategory,
  DeliveryRegion, AccountType, Currency, DocumentUploadType,
  UploadedDocument, MajorClient, KeyPersonnel,
  BUSINESS_TYPE_LABELS, BUSINESS_SIZE_LABELS, OWNERSHIP_TYPE_LABELS,
  SUPPLY_CATEGORY_LABELS, NIGERIAN_STATES, NIGERIAN_BANKS,
  PAYMENT_TERMS_OPTIONS, ISO_STANDARDS_OPTIONS,
  EMPLOYEE_RANGES, TURNOVER_RANGES,
} from '../../../domain/vendor-portal/vendor-registration.dto';

@Component({
  selector: 'app-vendor-registration',
  templateUrl: './vendor-registration.component.html',
  styleUrls: ['./vendor-registration.component.scss'],
})
export class VendorRegistrationComponent implements OnInit, OnDestroy {

  private destroy$ = new Subject<void>();

  // ── Steps ─────────────────────────────────────────────────────────────────
  currentStep   = 1;
  totalSteps    = 6;
  isSubmitting  = false;
  isSubmitted   = false;
  applicationNumber = '';
  autoSaveTimer: any;

  // Inline, non-blocking validation banner — replaces window.alert() for the
  // handful of cross-field checks (e.g. "pick at least one category") that
  // can't be expressed as a single control's Validators. A native alert()
  // stops the whole browser tab and reads as a crash, not a form; this reads
  // as part of the form.
  stepError: string | null = null;
  private stepErrorTimer: any;

  // Real save-state, not a permanently-on green dot. Ticks to 'saving' the
  // instant a step is persisted and back to 'idle' a moment later, so the
  // indicator actually reports something happening rather than asserting a
  // constant truth.
  saveState: 'idle' | 'saving' | 'saved' = 'idle';
  private saveStateTimer: any;

  readonly steps = [
    { n: 1, label: 'Business Identity',   icon: '🏢' },
    { n: 2, label: 'Legal & Compliance',  icon: '⚖️' },
    { n: 3, label: 'Contact & Location',  icon: '📍' },
    { n: 4, label: 'Banking & Finance',   icon: '🏦' },
    { n: 5, label: 'Capabilities',        icon: '⚙️' },
    { n: 6, label: 'Documents & Sign-off',icon: '📄' },
  ];

  // ── Forms ─────────────────────────────────────────────────────────────────
  form1!: FormGroup;
  form2!: FormGroup;
  form3!: FormGroup;
  form4!: FormGroup;
  form5!: FormGroup;
  form6!: FormGroup;

  // ── Constants exposed to template ─────────────────────────────────────────
  readonly BUSINESS_TYPE_LABELS    = BUSINESS_TYPE_LABELS;
  readonly BUSINESS_SIZE_LABELS    = BUSINESS_SIZE_LABELS;
  readonly OWNERSHIP_TYPE_LABELS   = OWNERSHIP_TYPE_LABELS;
  readonly SUPPLY_CATEGORY_LABELS  = SUPPLY_CATEGORY_LABELS;
  readonly NIGERIAN_STATES         = NIGERIAN_STATES;
  readonly NIGERIAN_BANKS          = NIGERIAN_BANKS;
  readonly PAYMENT_TERMS_OPTIONS   = PAYMENT_TERMS_OPTIONS;
  readonly ISO_STANDARDS_OPTIONS   = ISO_STANDARDS_OPTIONS;
  readonly EMPLOYEE_RANGES         = EMPLOYEE_RANGES;
  readonly TURNOVER_RANGES         = TURNOVER_RANGES;

  readonly businessTypes    = Object.keys(BUSINESS_TYPE_LABELS)    as BusinessType[];
  readonly businessSizes    = Object.keys(BUSINESS_SIZE_LABELS)    as BusinessSize[];
  readonly ownershipTypes   = Object.keys(OWNERSHIP_TYPE_LABELS)   as OwnershipType[];
  readonly supplyCategories = Object.keys(SUPPLY_CATEGORY_LABELS)  as SupplyCategory[];

  readonly currencies: Currency[]    = ['NGN', 'USD', 'GBP', 'EUR', 'GHS', 'KES', 'ZAR'];
  readonly accountTypes: AccountType[] = ['current', 'savings', 'domiciliary'];
  readonly currentYear = new Date().getFullYear();

  readonly deliveryRegionOptions: { value: DeliveryRegion; label: string }[] = [
    { value: 'lagos',       label: 'Lagos' },
    { value: 'abuja',       label: 'Abuja (FCT)' },
    { value: 'rivers',      label: 'Rivers' },
    { value: 'kano',        label: 'Kano' },
    { value: 'oyo',         label: 'Oyo' },
    { value: 'delta',       label: 'Delta' },
    { value: 'anambra',     label: 'Anambra' },
    { value: 'edo',         label: 'Edo' },
    { value: 'enugu',       label: 'Enugu' },
    { value: 'kwara',       label: 'Kwara' },
    { value: 'ogun',        label: 'Ogun' },
    { value: 'ondo',        label: 'Ondo' },
    { value: 'osun',        label: 'Osun' },
    { value: 'ekiti',       label: 'Ekiti' },
    { value: 'cross_river', label: 'Cross River' },
    { value: 'akwa_ibom',   label: 'Akwa Ibom' },
    { value: 'bayelsa',     label: 'Bayelsa' },
    { value: 'imo',         label: 'Imo' },
    { value: 'abia',        label: 'Abia' },
    { value: 'benue',       label: 'Benue' },
    { value: 'kogi',        label: 'Kogi' },
    { value: 'nasarawa',    label: 'Nasarawa' },
    { value: 'plateau',     label: 'Plateau' },
    { value: 'kaduna',      label: 'Kaduna' },
    { value: 'nationwide',  label: 'Nationwide (All States)' },
    { value: 'international', label: 'International' },
  ];

  // ── Dynamic lists ─────────────────────────────────────────────────────────
  majorClients:     MajorClient[]     = [];
  keyPersonnel:     KeyPersonnel[]    = [];
  uploadedDocuments: UploadedDocument[] = [];
  selectedIsoStandards: string[]      = [];
  selectedCategories:   SupplyCategory[] = [];
  selectedRegions:      DeliveryRegion[] = [];

  // ── File upload ───────────────────────────────────────────────────────────
  logoPreview: string | null = null;

  // ── Document upload type currently being uploaded ─────────────────────────
  uploadingDocType: DocumentUploadType | null = null;
  uploadingDocLabel = '';

  readonly requiredDocTypes: { type: DocumentUploadType; label: string; required: boolean; hint: string }[] = [
    { type: 'cac_certificate',           label: 'CAC Certificate of Incorporation',  required: true,  hint: 'Issued by the Corporate Affairs Commission' },
    { type: 'tax_clearance',             label: 'Tax Clearance Certificate',          required: true,  hint: 'Must be current — valid for current year' },
    { type: 'vat_certificate',           label: 'VAT Registration Certificate',       required: false, hint: 'Required if VAT registered' },
    { type: 'public_liability_insurance',label: 'Public Liability Insurance Policy',  required: true,  hint: 'Must include policy number and expiry date' },
    { type: 'professional_indemnity',    label: 'Professional Indemnity Certificate', required: false, hint: 'Required for consultancy/professional services' },
    { type: 'iso_certificate',           label: 'ISO Certification(s)',               required: false, hint: 'If ISO-certified, upload certificate here' },
    { type: 'annual_accounts',           label: 'Audited Annual Accounts',            required: false, hint: 'Last two years of audited accounts' },
    { type: 'company_profile',           label: 'Company Profile',                    required: false, hint: 'Detailed company overview document' },
    { type: 'bank_reference_letter',     label: 'Bank Reference Letter',              required: false, hint: 'Reference letter from your primary bank' },
  ];

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private regService: VendorRegistrationService,
  ) {}

  ngOnInit(): void {
    this.buildForms();
    this.loadDraft();
    this.watchConditionalFields();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    if (this.autoSaveTimer) clearInterval(this.autoSaveTimer);
    clearTimeout(this.stepErrorTimer);
    clearTimeout(this.saveStateTimer);
  }

  // ── Build forms ───────────────────────────────────────────────────────────
  private buildForms(): void {
    this.form1 = this.fb.group({
      businessName:        ['', [Validators.required, Validators.minLength(3), Validators.maxLength(200)]],
      tradingName:         [''],
      businessType:        ['limited_liability', Validators.required],
      businessSize:        ['small', Validators.required],
      ownershipType:       ['indigenous', Validators.required],
      yearEstablished:     [2000, [Validators.required, Validators.min(1800), Validators.max(this.currentYear)]],
      numberOfEmployees:   ['', Validators.required],
      annualTurnoverRange: ['', Validators.required],
      currency:            ['NGN'],
      businessDescription: ['', [Validators.required, Validators.minLength(50), Validators.maxLength(1000)]],
      missionStatement:    [''],
      websiteUrl:          [''],
      linkedinUrl:         [''],
    });

    this.form2 = this.fb.group({
      cacRegistrationNumber:   ['', Validators.required],
      cacRegistrationDate:     ['', Validators.required],
      tinNumber:               ['', Validators.required],
      vatRegistered:           [false],
      vatNumber:               [''],
      taxClearanceExpiryDate:  [''],
      nafdacNumber:            [''],
      dprLicenceNumber:        [''],
      sonCertificationNumber:  [''],
      pencomNumber:            [''],
      nscNumber:               [''],
      otherLicences:           [''],
      hasPublicLiabilityInsurance: [false],
      publicLiabilityInsurer:  [''],
      publicLiabilityPolicyNo: [''],
      publicLiabilityExpiryDate: [''],
      hasProfessionalIndemnity: [false],
      professionalIndemnityInsurer:  [''],
      professionalIndemnityPolicyNo: [''],
      professionalIndemnityExpiry:   [''],
      otherCertifications:     [''],
      hasBeenBlacklisted:      [false],
      blacklistedDetails:      [''],
      hasLitigationPending:    [false],
      litigationDetails:       [''],
      hasCriminalConviction:   [false],
      criminalDetails:         [''],
    });

    this.form3 = this.fb.group({
      primaryContactName:    ['', Validators.required],
      primaryContactTitle:   ['', Validators.required],
      primaryContactEmail:   ['', [Validators.required, Validators.email]],
      primaryContactPhone:   ['', Validators.required],
      primaryContactPhone2:  [''],
      hasSecondaryContact:   [false],
      secondaryContactName:  [''],
      secondaryContactTitle: [''],
      secondaryContactEmail: [''],
      secondaryContactPhone: [''],
      registeredAddressLine1:  ['', Validators.required],
      registeredAddressLine2:  [''],
      registeredCity:          ['', Validators.required],
      registeredState:         ['', Validators.required],
      registeredPostalCode:    [''],
      registeredCountry:       ['Nigeria', Validators.required],
      operatingAddressSameAsRegistered: [true],
      operatingAddressLine1:   [''],
      operatingAddressLine2:   [''],
      operatingCity:           [''],
      operatingState:          [''],
      operatingCountry:        ['Nigeria'],
      hasWarehouse:            [false],
      warehouseAddressLine1:   [''],
      warehouseCity:           [''],
      warehouseState:          [''],
      warehouseCapacity:       [''],
      hasOwnDeliveryFleet:     [false],
      fleetSize:               [null],
      deliveryLeadTimeDays:    [7, [Validators.required, Validators.min(1)]],
      canDeliverNationwide:    [false],
      canDeliverInternationally: [false],
    });

    this.form4 = this.fb.group({
      primaryBankName:         ['', Validators.required],
      primaryBankBranch:       [''],
      primaryAccountName:      ['', Validators.required],
      primaryAccountNumber:    ['', [Validators.required, Validators.pattern(/^\d{10}$/)]],
      primaryAccountType:      ['current', Validators.required],
      primaryCurrency:         ['NGN'],
      primarySortCode:         [''],
      primarySwiftCode:        [''],
      hasSecondaryBankAccount: [false],
      secondaryBankName:       [''],
      secondaryAccountName:    [''],
      secondaryAccountNumber:  [''],
      secondaryAccountType:    ['current'],
      secondaryCurrency:       ['NGN'],
      preferredPaymentTerms:   ['Net 30', Validators.required],
      acceptsAdvancePayment:   [false],
      advancePaymentPercentage:[null],
      acceptsLetterOfCredit:   [false],
      acceptsMobileMoney:      [false],
      mobileMoneyCurrency:     [''],
      mobileMoneyNumber:       [''],
      annualAuditedAccounts:   [false],
      auditFirmName:           [''],
      lastAuditYear:           [null],
      bankReference1Name:      [''],
      bankReference1Contact:   [''],
      tradeReference1Company:  [''],
      tradeReference1Contact:  [''],
      tradeReference1Email:    [''],
      tradeReference2Company:  [''],
      tradeReference2Contact:  [''],
      tradeReference2Email:    [''],
    });

    this.form5 = this.fb.group({
      primaryCategory:          ['', Validators.required],
      categoryDescription:      ['', [Validators.required, Validators.minLength(30)]],
      canHandleEmergencyOrders: [false],
      emergencyLeadTimeHours:   [null],
      minimumOrderValue:        [null],
      maximumOrderValue:        [null],
      bulkDiscountAvailable:    [false],
      bulkDiscountDetails:      [''],
      hasQualityManagementSystem: [false],
      qmsStandard:              [''],
      hasInspectionFacility:    [false],
      testingEquipmentList:     [''],
      isManufacturer:           [false],
      isDistributor:            [false],
      isServiceProvider:        [false],
      isImporter:               [false],
      primarySuppliersCountries:[''],
      completedProjectsCount:   [0, [Validators.required, Validators.min(0)]],
      averageProjectValue:      [null],
      largestProjectValue:      [null],
      largestProjectDescription:[''],
      technicalStaffCount:      [null],
      industryAssociations:     [''],
      professionalMemberships:  [''],
      awardsRecognitions:       [''],
    });

    this.form6 = this.fb.group({
      declarantName:    ['', Validators.required],
      declarantTitle:   ['', Validators.required],
      declarantEmail:   ['', [Validators.required, Validators.email]],
      declarantPhone:   ['', Validators.required],
      declarationDate:  [new Date().toISOString().split('T')[0]],
      agreedToTerms:         [false, Validators.requiredTrue],
      agreedToPrivacyPolicy: [false, Validators.requiredTrue],
      agreedToCodeOfConduct: [false, Validators.requiredTrue],
      agreedToAntiCorruption:[false, Validators.requiredTrue],
      confirmedAccuracy:     [false, Validators.requiredTrue],
    });
  }

  private watchConditionalFields(): void {
    // VAT number required if VAT registered
    this.form2.get('vatRegistered')?.valueChanges.pipe(takeUntil(this.destroy$)).subscribe(v => {
      const c = this.form2.get('vatNumber');
      v ? c?.setValidators(Validators.required) : c?.clearValidators();
      c?.updateValueAndValidity();
    });

    // Blacklisted details required
    this.form2.get('hasBeenBlacklisted')?.valueChanges.pipe(takeUntil(this.destroy$)).subscribe(v => {
      const c = this.form2.get('blacklistedDetails');
      v ? c?.setValidators(Validators.required) : c?.clearValidators();
      c?.updateValueAndValidity();
    });

    // Litigation details required
    this.form2.get('hasLitigationPending')?.valueChanges.pipe(takeUntil(this.destroy$)).subscribe(v => {
      const c = this.form2.get('litigationDetails');
      v ? c?.setValidators(Validators.required) : c?.clearValidators();
      c?.updateValueAndValidity();
    });

    // Fleet size required if has fleet
    this.form3.get('hasOwnDeliveryFleet')?.valueChanges.pipe(takeUntil(this.destroy$)).subscribe(v => {
      const c = this.form3.get('fleetSize');
      v ? c?.setValidators([Validators.required, Validators.min(1)]) : c?.clearValidators();
      c?.updateValueAndValidity();
    });

    // Advance payment percentage
    this.form4.get('acceptsAdvancePayment')?.valueChanges.pipe(takeUntil(this.destroy$)).subscribe(v => {
      const c = this.form4.get('advancePaymentPercentage');
      v ? c?.setValidators([Validators.required, Validators.min(1), Validators.max(100)]) : c?.clearValidators();
      c?.updateValueAndValidity();
    });
  }

  private loadDraft(): void {
    const draft = this.regService.getDraft();
    if (!draft) return;
    try {
      if (draft.step1) this.form1.patchValue(draft.step1);
      if (draft.step2) {
        this.form2.patchValue(draft.step2);
        this.selectedIsoStandards = draft.step2.isoStandards ?? [];
      }
      if (draft.step3) {
        this.form3.patchValue(draft.step3);
        this.selectedRegions = draft.step3.deliveryRegions ?? [];
      }
      if (draft.step4) this.form4.patchValue(draft.step4);
      if (draft.step5) {
        this.form5.patchValue(draft.step5);
        this.selectedCategories = draft.step5.supplyCategories ?? [];
        this.majorClients       = draft.step5.majorClients ?? [];
        this.keyPersonnel       = draft.step5.keyPersonnelList ?? [];
      }
      if (draft.step6) {
        this.form6.patchValue(draft.step6);
        this.uploadedDocuments = draft.step6.uploadedDocuments ?? [];
      }
    } catch { /* ignore patch errors */ }
  }

  // ── Navigation ────────────────────────────────────────────────────────────
  nextStep(): void {
    const form = this.currentFormGroup;
    if (!this.validateStep(form)) return;
    this.stepError = null;
    this.autoSaveStep();
    if (this.currentStep < this.totalSteps) {
      this.currentStep++;
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  prevStep(): void {
    this.stepError = null;
    this.autoSaveStep();
    if (this.currentStep > 1) {
      this.currentStep--;
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  goToStep(n: number): void {
    if (n < this.currentStep) {
      this.stepError = null;
      this.autoSaveStep();
      this.currentStep = n;
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  get currentFormGroup(): FormGroup {
    const map: Record<number, FormGroup> = {
      1: this.form1, 2: this.form2, 3: this.form3,
      4: this.form4, 5: this.form5, 6: this.form6,
    };
    return map[this.currentStep];
  }

  private validateStep(form: FormGroup): boolean {
    form.markAllAsTouched();
    if (form.invalid) {
      // Scroll to first error
      setTimeout(() => {
        const el = document.querySelector('.vr-input--err, .vr-select--err, .vr-textarea--err');
        el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 50);
      return false;
    }
    // Step-specific extra validations
    if (this.currentStep === 5 && this.selectedCategories.length === 0) {
      this.showStepError('Please select at least one supply category.');
      return false;
    }
    if (this.currentStep === 3 && this.selectedRegions.length === 0) {
      this.showStepError('Please select at least one delivery region.');
      return false;
    }
    return true;
  }

  private showStepError(message: string): void {
    this.stepError = message;
    clearTimeout(this.stepErrorTimer);
    this.stepErrorTimer = setTimeout(() => (this.stepError = null), 5000);
    setTimeout(() => {
      document.querySelector('.vr-banner--error')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 50);
  }

  private autoSaveStep(): void {
    switch (this.currentStep) {
      case 1: this.regService.saveStep1({ ...this.form1.value }); break;
      case 2: this.regService.saveStep2({ ...this.form2.value, isoStandards: this.selectedIsoStandards }); break;
      case 3: this.regService.saveStep3({ ...this.form3.value, deliveryRegions: this.selectedRegions }); break;
      case 4: this.regService.saveStep4({ ...this.form4.value }); break;
      case 5: this.regService.saveStep5({ ...this.form5.value, supplyCategories: this.selectedCategories, majorClients: this.majorClients, keyPersonnelList: this.keyPersonnel }); break;
      case 6: this.regService.saveStep6({ ...this.form6.value, uploadedDocuments: this.uploadedDocuments }); break;
    }
    this.pulseSaveState();
  }

  private pulseSaveState(): void {
    this.saveState = 'saving';
    clearTimeout(this.saveStateTimer);
    this.saveStateTimer = setTimeout(() => {
      this.saveState = 'saved';
      this.saveStateTimer = setTimeout(() => (this.saveState = 'idle'), 2200);
    }, 350);
  }

  // ── Submit ────────────────────────────────────────────────────────────────
  onSubmit(): void {
    this.form6.markAllAsTouched();
    if (this.form6.invalid) return;

    const requiredMissing = this.requiredDocTypes
      .filter(d => d.required && !this.uploadedDocuments.find(u => u.type === d.type));

    if (requiredMissing.length > 0) {
      this.showStepError(`Please upload required document: "${requiredMissing[0].label}"`);
      return;
    }

    this.isSubmitting = true;
    this.stepError = null;
    this.autoSaveStep();

    const fullReg = {
      status: 'submitted' as const,
      step1: this.form1.value,
      step2: { ...this.form2.value, isoStandards: this.selectedIsoStandards },
      step3: { ...this.form3.value, deliveryRegions: this.selectedRegions },
      step4: this.form4.value,
      step5: { ...this.form5.value, supplyCategories: this.selectedCategories, majorClients: this.majorClients, keyPersonnelList: this.keyPersonnel },
      step6: { ...this.form6.value, uploadedDocuments: this.uploadedDocuments },
    };

    this.regService.submit(fullReg as any).pipe(take(1)).subscribe({
      next: (res) => {
        this.isSubmitting    = false;
        this.isSubmitted     = true;
        this.applicationNumber = res.applicationNumber;
        window.scrollTo({ top: 0, behavior: 'smooth' });
      },
      error: () => {
        this.isSubmitting = false;
        this.showStepError('Submission failed. Please check your connection and try again.');
      },
    });
  }

  // ── ISO Standards multi-select ────────────────────────────────────────────
  toggleIso(std: string): void {
    const idx = this.selectedIsoStandards.indexOf(std);
    idx > -1 ? this.selectedIsoStandards.splice(idx, 1) : this.selectedIsoStandards.push(std);
  }
  isIsoSelected(std: string): boolean { return this.selectedIsoStandards.includes(std); }

  // ── Supply categories multi-select ────────────────────────────────────────
  toggleCategory(cat: SupplyCategory): void {
    const idx = this.selectedCategories.indexOf(cat);
    idx > -1 ? this.selectedCategories.splice(idx, 1) : this.selectedCategories.push(cat);
    // Auto-set primary if only one selected
    if (this.selectedCategories.length === 1) {
      this.form5.get('primaryCategory')?.setValue(this.selectedCategories[0]);
    }
  }
  isCategorySelected(cat: SupplyCategory): boolean { return this.selectedCategories.includes(cat); }

  // ── Delivery regions multi-select ─────────────────────────────────────────
  toggleRegion(r: DeliveryRegion): void {
    const idx = this.selectedRegions.indexOf(r);
    idx > -1 ? this.selectedRegions.splice(idx, 1) : this.selectedRegions.push(r);
    this.form3.get('canDeliverNationwide')?.setValue(this.selectedRegions.includes('nationwide'));
  }
  isRegionSelected(r: DeliveryRegion): boolean { return this.selectedRegions.includes(r); }

  // ── Major clients ─────────────────────────────────────────────────────────
  addClient(): void {
    this.majorClients.push({ id: `cl-${Date.now()}`, companyName: '' });
  }
  removeClient(i: number): void { this.majorClients.splice(i, 1); }

  // ── Key personnel ─────────────────────────────────────────────────────────
  addPersonnel(): void {
    this.keyPersonnel.push({ id: `kp-${Date.now()}`, name: '', title: '' });
  }
  removePersonnel(i: number): void { this.keyPersonnel.splice(i, 1); }

  // ── Logo upload ───────────────────────────────────────────────────────────
  onLogoSelected(e: Event): void {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { this.showStepError('Please select an image file.'); return; }
    if (file.size > 5 * 1024 * 1024) { this.showStepError('Logo must be under 5 MB.'); return; }
    const reader = new FileReader();
    reader.onload = ev => { this.logoPreview = ev.target?.result as string; };
    reader.readAsDataURL(file);
  }

  // ── Document upload ───────────────────────────────────────────────────────
  triggerDocUpload(type: DocumentUploadType, label: string): void {
    this.uploadingDocType  = type;
    this.uploadingDocLabel = label;
    setTimeout(() => document.getElementById('docFileInput')?.click(), 50);
  }

  onDocFileSelected(e: Event): void {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file || !this.uploadingDocType) return;
    if (file.size > 15 * 1024 * 1024) { this.showStepError(`${file.name} exceeds 15 MB.`); return; }

    this.regService.uploadFile(file, this.uploadingDocType)
      .pipe(take(1))
      .subscribe(doc => {
        // Replace if same type already uploaded
        const idx = this.uploadedDocuments.findIndex(d => d.type === doc.type);
        if (idx > -1) this.uploadedDocuments[idx] = doc;
        else this.uploadedDocuments.push(doc);
        this.uploadingDocType = null;
        // Reset input
        (e.target as HTMLInputElement).value = '';
      });
  }

  removeDoc(id: string): void {
    this.uploadedDocuments = this.uploadedDocuments.filter(d => d.id !== id);
  }

  getUploadedDoc(type: DocumentUploadType): UploadedDocument | undefined {
    return this.uploadedDocuments.find(d => d.type === type);
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  isInvalid(form: FormGroup, field: string): boolean {
    const c = form.get(field);
    return !!c && c.invalid && (c.dirty || c.touched);
  }

  get completionPercent(): number {
    return Math.round(((this.currentStep - 1) / this.totalSteps) * 100);
  }

  get today(): string { return new Date().toISOString().split('T')[0]; }
  get maxYear(): number { return this.currentYear; }

  formatSize(bytes: number): string { return this.regService.formatSize(bytes); }

  // ── Review summary (Step 6) ──────────────────────────────────────────────────
  // A quiet, read-only recap of what was entered in steps 1–5, with a jump-back
  // link per row — so the very last thing before submitting a 6-step form is a
  // chance to catch a typo, not a wall of new document-upload fields.
  get reviewRows(): { label: string; value: string; step: number }[] {
    const f1 = this.form1.value, f3 = this.form3.value, f4 = this.form4.value, f5 = this.form5.value;
    return [
      { label: 'Business name', value: f1.businessName || '—', step: 1 },
      { label: 'Business type', value: f1.businessType ? this.BUSINESS_TYPE_LABELS[f1.businessType as BusinessType] : '—', step: 1 },
      { label: 'Supply categories', value: this.selectedCategories.length ? this.selectedCategories.map(c => this.SUPPLY_CATEGORY_LABELS[c]).join(', ') : '—', step: 5 },
      { label: 'Primary contact', value: f3.primaryContactName ? `${f3.primaryContactName} · ${f3.primaryContactEmail}` : '—', step: 3 },
      { label: 'Delivery regions', value: this.selectedRegions.length ? `${this.selectedRegions.length} region${this.selectedRegions.length === 1 ? '' : 's'}` : '—', step: 3 },
      { label: 'Primary bank account', value: f4.primaryBankName ? `${f4.primaryBankName} · ****${(f4.primaryAccountNumber || '').slice(-4)}` : '—', step: 4 },
    ];
  }
}
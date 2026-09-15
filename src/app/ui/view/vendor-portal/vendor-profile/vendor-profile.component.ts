import { Component, ElementRef, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { Subject } from 'rxjs';
import { takeUntil, take } from 'rxjs/operators';

import { VendorService } from '../../../service/vendor-portal/vendor.service';
import {
  VendorDocument, DocumentStats,
  DocumentCategory, DocumentStatus,
  VendorProfile, DocumentTemplate, TemplateDocType,
  LogoPosition, TemplateDensity, TemplateBaseStyle,
} from '../../../domain/vendor-portal/vendor.dto';

type CategoryFilter = 'all' | DocumentCategory;
type ProfileTab = 'profile' | 'documents' | 'branding';

@Component({
  selector: 'app-vendor-profile',
  templateUrl: './vendor-profile.component.html',
  styleUrl: './vendor-profile.component.scss',
})
export class VendorProfileComponent implements OnInit, OnDestroy {

  private destroy$ = new Subject<void>();

  activeTab: ProfileTab = 'profile';

  // ── Profile ───────────────────────────────────────────────────────────────────
  profile: VendorProfile | null = null;

  // ── Documents ─────────────────────────────────────────────────────────────────
  allDocs:  VendorDocument[] = [];
  docs:     VendorDocument[] = [];
  stats:    DocumentStats | null = null;
  filter:   CategoryFilter  = 'all';

  showUploadModal = false;
  uploadForm = {
    name:       '',
    category:   'registration' as DocumentCategory,
    fileName:   '',
    fileSize:   '',
    fileType:   'pdf',
    expiryDate: '',
    notes:      '',
    isRequired: false,
  };
  uploadErrors: Partial<Record<keyof typeof this.uploadForm, string>> = {};

  showDeleteConfirm = false;
  docToDelete: VendorDocument | null = null;

  showPanel    = false;
  selectedDoc: VendorDocument | null = null;

  readonly categoryFilters: { label: string; value: CategoryFilter }[] = [
    { label: 'All',           value: 'all'           },
    { label: 'Registration',  value: 'registration'  },
    { label: 'Tax',           value: 'tax'           },
    { label: 'Licence',       value: 'licence'       },
    { label: 'Insurance',     value: 'insurance'     },
    { label: 'Certification', value: 'certification' },
    { label: 'Other',         value: 'other'         },
  ];

  readonly categoryOptions: { label: string; value: DocumentCategory }[] = [
    { label: 'Registration',  value: 'registration'  },
    { label: 'Tax',           value: 'tax'           },
    { label: 'Licence',       value: 'licence'       },
    { label: 'Insurance',     value: 'insurance'     },
    { label: 'Certification', value: 'certification' },
    { label: 'Other',         value: 'other'         },
  ];

  // ── Branding / Document Templates ────────────────────────────────────────────
  templateDocType: TemplateDocType = 'invoice';
  templates: DocumentTemplate[] = [];
  editingTemplate: DocumentTemplate | null = null;

  @ViewChild('previewRef')    previewRef!:    ElementRef<HTMLDivElement>;
  @ViewChild('signatureCanvas') signatureCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('logoFileInput') logoFileInput!: ElementRef<HTMLInputElement>;
  isDownloading   = false;
  showSignaturePad = false;
  isDrawing        = false;
  logoUploadError: string | null = null;

  // Your signature is a profile-level asset (like your logo) — draw it once
  // here, then decide per-document whether to attach it when you create a
  // quotation or invoice. It's not a template setting.
  get savedSignatureDataUrl(): string | null {
    return this.profile?.signatureDataUrl ?? null;
  }

  // ── Base style picker ────────────────────────────────────────────────────────
  readonly baseStyles: { value: TemplateBaseStyle; label: string; desc: string }[] = [
    { value: 'classic', label: 'Classic',  desc: 'Clean letterhead, ruled table' },
    { value: 'bold',    label: 'Bold',     desc: 'Full-width accent header bar'  },
    { value: 'sidebar', label: 'Sidebar',  desc: 'Rotated doc label on left edge'},
    { value: 'modern',  label: 'Modern',   desc: 'Two-tone header, label boxes'  },
  ];

  readonly logoPositions: { v: LogoPosition; label: string }[] = [
    { v: 'left',   label: 'Left'   },
    { v: 'center', label: 'Centre' },
    { v: 'right',  label: 'Right'  },
  ];

  templateForm = {
    name:              '',
    baseStyle:         'classic' as TemplateBaseStyle,
    logoUrl:           undefined as string | undefined,
    logoPosition:      'left'    as LogoPosition,
    accentColor:       '#224957',
    density:           'detailed' as TemplateDensity,
    footerText:        '',
    showBankDetails:   true,
    notesDefault:      '',
  };

  // Static sample data — reflects styling only, not real order data
  readonly previewSample = {
    docNumber:     'INV-2026-0148',
    date:          'June 28, 2026',
    dueDate:       'July 12, 2026',
    clientName:    'Lagos Continental Hotels Ltd',
    clientAddress: 'Plot 1234, Ozumba Mbadiwe Ave, Victoria Island, Lagos',
    poReference:   'PO-2026-0089',
    items: [
      { name: 'Industrial Air Compressor (5HP)', qty: 2, unitPrice: 185000, total: 370000 },
      { name: 'Safety Valve Assembly',           qty: 6, unitPrice: 12500,  total: 75000  },
      { name: 'Pressure Gauge (0-200 PSI)',      qty: 6, unitPrice: 4500,   total: 27000  },
    ],
    subtotal: 472000,
    tax:      35400,
    total:    507400,
  };

  constructor(private vendorService: VendorService) {}

  ngOnInit(): void {
    this.vendorService.getProfile()
      .pipe(takeUntil(this.destroy$))
      .subscribe(p => this.profile = p);

    this.vendorService.getDocuments()
      .pipe(takeUntil(this.destroy$))
      .subscribe(list => { this.allDocs = list; this.applyFilter(); });

    this.vendorService.getDocumentStats()
      .pipe(take(1))
      .subscribe(s => this.stats = s);

    this.loadTemplates();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ── Tabs ──────────────────────────────────────────────────────────────────────
  setTab(tab: ProfileTab): void { this.activeTab = tab; }

  // ════════════════════════════════════════════════════════════════════════════
  //  PROFILE  (view-only)
  // ════════════════════════════════════════════════════════════════════════════

  verificationBadge(status: VendorProfile['verificationStatus']): string {
    const m: Record<VendorProfile['verificationStatus'], string> = {
      verified:   'badge badge-active',
      pending:    'badge badge-pending',
      unverified: 'badge badge-expired',
    };
    return m[status] ?? 'badge';
  }

  verificationTone(status: VendorProfile['verificationStatus']): 'success' | 'info' | 'danger' {
    const m: Record<VendorProfile['verificationStatus'], 'success' | 'info' | 'danger'> = {
      verified: 'success', pending: 'info', unverified: 'danger',
    };
    return m[status] ?? 'danger';
  }

  verificationIcon(status: VendorProfile['verificationStatus']): 'check' | 'clock' | 'x' {
    const m: Record<VendorProfile['verificationStatus'], 'check' | 'clock' | 'x'> = {
      verified: 'check', pending: 'clock', unverified: 'x',
    };
    return m[status] ?? 'x';
  }

  verificationLabel(status: VendorProfile['verificationStatus']): string {
    const m: Record<VendorProfile['verificationStatus'], string> = {
      verified:   'Verified',
      pending:    'Pending Verification',
      unverified: 'Not Verified',
    };
    return m[status] ?? status;
  }

  maskAccountNumber(num: string): string {
    if (num.length <= 4) return num;
    return `${'•'.repeat(num.length - 4)}${num.slice(-4)}`;
  }

  // ════════════════════════════════════════════════════════════════════════════
  //  DOCUMENTS
  // ════════════════════════════════════════════════════════════════════════════

  setFilter(f: CategoryFilter): void { this.filter = f; this.applyFilter(); }

  private applyFilter(): void {
    this.docs = this.filter === 'all'
      ? this.allDocs
      : this.allDocs.filter(d => d.category === this.filter);
  }

  openPanel(doc: VendorDocument): void  { this.selectedDoc = doc; this.showPanel = true; }
  closePanel(): void { this.showPanel = false; this.selectedDoc = null; }

  openUploadModal(): void {
    this.uploadForm = {
      name: '', category: 'registration', fileName: '', fileSize: '',
      fileType: 'pdf', expiryDate: '', notes: '', isRequired: false,
    };
    this.uploadErrors = {};
    this.showUploadModal = true;
  }

  closeUploadModal(): void { this.showUploadModal = false; }

  simulateFilePick(): void {
    this.uploadForm.fileName = `document_${Date.now()}.pdf`;
    this.uploadForm.fileSize = '1.2 MB';
    this.uploadForm.fileType = 'pdf';
  }

  submitUpload(): void {
    this.uploadErrors = {};
    if (!this.uploadForm.name.trim()) { this.uploadErrors['name']     = 'Document name is required.'; }
    if (!this.uploadForm.fileName)    { this.uploadErrors['fileName'] = 'Please select a file.'; }
    if (Object.keys(this.uploadErrors).length > 0) return;

    const vendorId = sessionStorage.getItem('userid') || '';
    this.vendorService.uploadDocument(vendorId, {
      name:       this.uploadForm.name.trim(),
      category:   this.uploadForm.category,
      fileUrl:    '#',
      fileName:   this.uploadForm.fileName,
      fileSize:   this.uploadForm.fileSize || '—',
      fileType:   this.uploadForm.fileType,
      expiryDate: this.uploadForm.expiryDate ? new Date(this.uploadForm.expiryDate) : undefined,
      notes:      this.uploadForm.notes || undefined,
      isRequired: this.uploadForm.isRequired,
    }).subscribe();

    this.vendorService.getDocumentStats().pipe(take(1)).subscribe(s => this.stats = s);
    this.closeUploadModal();
  }

  openDeleteConfirm(doc: VendorDocument, e: MouseEvent): void {
    e.stopPropagation();
    this.docToDelete = doc;
    this.showDeleteConfirm = true;
  }

  closeDeleteConfirm(): void { this.showDeleteConfirm = false; this.docToDelete = null; }

  confirmDelete(): void {
    if (!this.docToDelete) return;
    this.vendorService.deleteDocument(this.docToDelete.id);
    this.vendorService.getDocumentStats().pipe(take(1)).subscribe(s => this.stats = s);
    if (this.selectedDoc?.id === this.docToDelete.id) { this.closePanel(); }
    this.closeDeleteConfirm();
  }

  downloadDoc(doc: VendorDocument, e: MouseEvent): void {
    e.stopPropagation();
    console.log('[Profile/Documents] Download:', doc.fileName);
  }

  fmtDate(d: Date | undefined): string {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-NG', {
      day: '2-digit', month: 'short', year: 'numeric',
    });
  }

  daysUntilExpiry(d: Date): number {
    return Math.ceil((new Date(d).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  }

  statusBadge(status: DocumentStatus): string {
    const m: Record<DocumentStatus, string> = {
      active:         'badge-active',
      expiring_soon:  'badge-expiring',
      expired:        'badge-expired',
      pending_review: 'badge-pending',
    };
    return `badge ${m[status] ?? ''}`;
  }

  statusTone(status: DocumentStatus): 'success' | 'warning' | 'danger' | 'info' {
    const m: Record<DocumentStatus, 'success' | 'warning' | 'danger' | 'info'> = {
      active: 'success', expiring_soon: 'warning', expired: 'danger', pending_review: 'info',
    };
    return m[status] ?? 'info';
  }

  statusIcon(status: DocumentStatus): 'check' | 'clock' | 'x' | 'half' {
    const m: Record<DocumentStatus, 'check' | 'clock' | 'x' | 'half'> = {
      active: 'check', expiring_soon: 'clock', expired: 'x', pending_review: 'half',
    };
    return m[status] ?? 'half';
  }

  statusLabel(status: DocumentStatus): string {
    const m: Record<DocumentStatus, string> = {
      active:         'Active',
      expiring_soon:  'Expiring Soon',
      expired:        'Expired',
      pending_review: 'Pending Review',
    };
    return m[status] ?? status;
  }

  categoryLabel(cat: DocumentCategory): string {
    const m: Record<DocumentCategory, string> = {
      registration: 'Registration', tax: 'Tax',  licence: 'Licence',
      insurance:    'Insurance', certification: 'Certification', other: 'Other',
    };
    return m[cat] ?? cat;
  }

  categoryIcon(cat: DocumentCategory): string {
    const m: Record<DocumentCategory, string> = {
      registration: '🏢', tax: '🧾',  licence: '📋',
      insurance:    '🛡️', certification: '🎖️', other: '📄',
    };
    return m[cat] ?? '📄';
  }

  // ════════════════════════════════════════════════════════════════════════════
  //  BRANDING
  // ════════════════════════════════════════════════════════════════════════════

  private loadTemplates(): void {
    this.vendorService.getTemplates(this.templateDocType)
      .pipe(takeUntil(this.destroy$))
      .subscribe(list => {
        this.templates = list;
        const active = list.find(t => t.isActive);
        if (active && !this.editingTemplate) {
          this.loadTemplateIntoForm(active);
        }
      });
  }

  setTemplateDocType(type: TemplateDocType): void {
    this.templateDocType = type;
    this.editingTemplate = null;
    this.loadTemplates();
  }

  loadTemplateIntoForm(template: DocumentTemplate): void {
    this.editingTemplate = template;
    this.templateForm = {
      name:              template.name,
      baseStyle:         template.baseStyle,
      logoUrl:           template.logoUrl,
      logoPosition:      template.logoPosition,
      accentColor:       template.accentColor,
      density:           template.density,
      footerText:        template.footerText   || '',
      showBankDetails:   template.showBankDetails,
      notesDefault:      template.notesDefault || '',
    };
    this.logoUploadError = null;
  }

  startNewTemplate(): void {
    this.editingTemplate = null;
    this.templateForm = {
      name:              'New Template',
      baseStyle:         'classic',
      logoUrl:           undefined,
      logoPosition:      'left',
      accentColor:       '#224957',
      density:           'detailed',
      footerText:        '',
      showBankDetails:   this.templateDocType === 'invoice',
      notesDefault:      '',
    };
    this.logoUploadError = null;
  }

  saveTemplate(): void {
    if (!this.templateForm.name.trim()) return;

    this.vendorService.saveTemplate({
      name:              this.templateForm.name.trim(),
      docType:           this.templateDocType,
      isActive:          this.editingTemplate?.isActive ?? false,
      baseStyle:         this.templateForm.baseStyle,
      logoUrl:           this.templateForm.logoUrl,
      logoPosition:      this.templateForm.logoPosition,
      accentColor:       this.templateForm.accentColor,
      density:           this.templateForm.density,
      footerText:        this.templateForm.footerText   || undefined,
      showBankDetails:   this.templateForm.showBankDetails,
      notesDefault:      this.templateForm.notesDefault || undefined,
    }, this.editingTemplate?.id);

    this.loadTemplates();
  }

  setActiveTemplate(template: DocumentTemplate): void {
    this.vendorService.setActiveTemplate(template.id, this.templateDocType);
    this.loadTemplates();
  }

  deleteTemplate(template: DocumentTemplate, e: MouseEvent): void {
    e.stopPropagation();
    if (template.isActive) return;
    this.vendorService.deleteTemplate(template.id);
    if (this.editingTemplate?.id === template.id) { this.editingTemplate = null; }
    this.loadTemplates();
  }

  // ── Logo upload ───────────────────────────────────────────────────────────────
  // Stored as a data URL directly on the template (same approach as the
  // signature pad below) — no backend upload endpoint needed for this demo,
  // and it travels with the template when saved/exported.
  triggerLogoUpload(): void {
    this.logoFileInput?.nativeElement.click();
  }

  onLogoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.logoUploadError = null;

    if (!file.type.startsWith('image/')) {
      this.logoUploadError = 'Please choose an image file (PNG, JPG, SVG or WebP).';
      input.value = '';
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      this.logoUploadError = 'Image is too large — please choose a file under 2MB.';
      input.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      this.templateForm.logoUrl = reader.result as string;
    };
    reader.onerror = () => {
      this.logoUploadError = 'Could not read that file — please try again.';
    };
    reader.readAsDataURL(file);
    input.value = ''; // allow re-selecting the same file later
  }

  removeLogo(): void {
    this.templateForm.logoUrl = undefined;
    this.logoUploadError = null;
  }

  // ── Helpers ───────────────────────────────────────────────────────────────────
  logoJustify(pos: LogoPosition): string {
    const m: Record<LogoPosition, string> = {
      left: 'flex-start', center: 'center', right: 'flex-end',
    };
    return m[pos];
  }

  docLabel(): string {
    return this.templateDocType === 'invoice' ? 'INVOICE' : 'QUOTATION';
  }

  // ── Signature canvas ──────────────────────────────────────────────────────────
  openSignaturePad(): void  { this.showSignaturePad = true; }
  closeSignaturePad(): void { this.showSignaturePad = false; }

  // Pointer events (works for mouse, touch and stylus)
  onSignaturePointerDown(e: PointerEvent): void {
    const canvas = this.signatureCanvas?.nativeElement;
    if (!canvas) return;
    canvas.setPointerCapture(e.pointerId);
    this.isDrawing = true;
    const ctx = canvas.getContext('2d')!;
    ctx.beginPath();
    ctx.moveTo(...this.canvasPoint(e, canvas));
  }

  onSignaturePointerMove(e: PointerEvent): void {
    if (!this.isDrawing) return;
    const canvas = this.signatureCanvas?.nativeElement;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    ctx.lineWidth   = e.pressure > 0 ? Math.max(1, e.pressure * 4) : 2;
    ctx.lineCap     = 'round';
    ctx.lineJoin    = 'round';
    ctx.strokeStyle = '#1a2c35';
    ctx.lineTo(...this.canvasPoint(e, canvas));
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(...this.canvasPoint(e, canvas));
  }

  onSignaturePointerUp(): void { this.isDrawing = false; }

  private canvasPoint(e: PointerEvent, canvas: HTMLCanvasElement): [number, number] {
    const rect = canvas.getBoundingClientRect();
    return [
      (e.clientX - rect.left) * (canvas.width  / rect.width),
      (e.clientY - rect.top)  * (canvas.height / rect.height),
    ];
  }

  clearSignature(): void {
    const canvas = this.signatureCanvas?.nativeElement;
    if (!canvas) return;
    canvas.getContext('2d')!.clearRect(0, 0, canvas.width, canvas.height);
  }

  saveSignature(): void {
    const canvas = this.signatureCanvas?.nativeElement;
    if (!canvas) return;
    this.vendorService.updateProfile({ signatureDataUrl: canvas.toDataURL('image/png') });
    this.closeSignaturePad();
  }

  clearSavedSignature(): void {
    this.vendorService.updateProfile({ signatureDataUrl: undefined });
  }

  // ── PDF export ────────────────────────────────────────────────────────────────
  async downloadTemplatePdf(): Promise<void> {
    if (!this.previewRef?.nativeElement || this.isDownloading) return;
    this.isDownloading = true;
    try {
      const html2canvas = (await import('html2canvas')).default;
      const { jsPDF }   = await import('jspdf');
      const canvas      = await html2canvas(this.previewRef.nativeElement, {
        scale: 2, useCORS: true, backgroundColor: '#ffffff', logging: false,
      });
      const pdf  = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pdfW = pdf.internal.pageSize.getWidth();
      const pdfH = (canvas.height * pdfW) / canvas.width;
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, pdfW, pdfH);
      const label    = this.templateDocType === 'invoice' ? 'Invoice' : 'Quotation';
      const safeName = (this.templateForm.name || 'Template').replace(/\s+/g, '_');
      pdf.save(`${label}_Template_${safeName}.pdf`);
    } catch (err) {
      console.error('[VendorProfile] PDF export failed:', err);
    } finally {
      this.isDownloading = false;
    }
  }

  fmtCurrency(n: number): string {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency', currency: 'NGN',
      minimumFractionDigits: 0, maximumFractionDigits: 0,
    }).format(n);
  }
}

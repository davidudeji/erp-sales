import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subject } from 'rxjs';
import { takeUntil, take } from 'rxjs/operators';

import { VendorService } from '../../../service/vendor-portal/vendor.service';
import {
  VendorDocument, DocumentStats,
  DocumentCategory, DocumentStatus,
} from '../../../domain/vendor-portal/vendor.dto';

type CategoryFilter = 'all' | DocumentCategory;

@Component({
  selector: 'app-documents',
  templateUrl: './documents.component.html',
  styleUrl: './documents.component.scss',
})
export class DocumentsComponent implements OnInit, OnDestroy {

  private destroy$ = new Subject<void>();

  allDocs:  VendorDocument[] = [];
  docs:     VendorDocument[] = [];
  stats:    DocumentStats | null = null;
  filter:   CategoryFilter  = 'all';

  // ── Upload modal ──────────────────────────────────────────────────────────────
  showUploadModal = false;
  uploadForm = {
    name:      '',
    category:  'registration' as DocumentCategory,
    fileName:  '',
    fileSize:  '',
    fileType:  'pdf',
    expiryDate: '',
    notes:     '',
    isRequired: false,
  };
  uploadErrors: Partial<Record<keyof typeof this.uploadForm, string>> = {};

  // ── Delete confirm ────────────────────────────────────────────────────────────
  showDeleteConfirm = false;
  docToDelete: VendorDocument | null = null;

  // ── Detail panel ──────────────────────────────────────────────────────────────
  showPanel    = false;
  selectedDoc: VendorDocument | null = null;

  readonly categoryFilters: { label: string; value: CategoryFilter }[] = [
    { label: 'All',            value: 'all' },
    { label: 'Registration',   value: 'registration' },
    { label: 'Tax',            value: 'tax' },
    { label: 'Licence',        value: 'licence' },
    { label: 'Insurance',      value: 'insurance' },
    { label: 'Certification',  value: 'certification' },
    { label: 'Other',          value: 'other' },
  ];

  readonly categoryOptions: { label: string; value: DocumentCategory }[] = [
    { label: 'Registration',  value: 'registration' },
    { label: 'Tax',           value: 'tax' },
    { label: 'Licence',       value: 'licence' },
    { label: 'Insurance',     value: 'insurance' },
    { label: 'Certification', value: 'certification' },
    { label: 'Other',         value: 'other' },
  ];

  constructor(private vendorService: VendorService) {}

  ngOnInit(): void {
    this.vendorService.getDocuments()
      .pipe(takeUntil(this.destroy$))
      .subscribe(list => { this.allDocs = list; this.applyFilter(); });
    this.vendorService.getDocumentStats().pipe(take(1)).subscribe(s => this.stats = s);
  }

  ngOnDestroy(): void { this.destroy$.next(); this.destroy$.complete(); }

  // ── Filter ────────────────────────────────────────────────────────────────────
  setFilter(f: CategoryFilter): void { this.filter = f; this.applyFilter(); }

  private applyFilter(): void {
    this.docs = this.filter === 'all'
      ? this.allDocs
      : this.allDocs.filter(d => d.category === this.filter);
  }

  // ── Panel ─────────────────────────────────────────────────────────────────────
  openPanel(doc: VendorDocument): void { this.selectedDoc = doc; this.showPanel = true; }
  closePanel(): void { this.showPanel = false; this.selectedDoc = null; }

  // ── Upload ────────────────────────────────────────────────────────────────────
  openUploadModal(): void {
    this.uploadForm = { name: '', category: 'registration', fileName: '', fileSize: '', fileType: 'pdf', expiryDate: '', notes: '', isRequired: false };
    this.uploadErrors = {};
    this.showUploadModal = true;
  }

  closeUploadModal(): void { this.showUploadModal = false; }

  // Simulate file pick — in real implementation wire to (change) on <input type="file">
  simulateFilePick(): void {
    this.uploadForm.fileName = `document_${Date.now()}.pdf`;
    this.uploadForm.fileSize = '1.2 MB';
    this.uploadForm.fileType = 'pdf';
  }

  submitUpload(): void {
    this.uploadErrors = {};
    if (!this.uploadForm.name.trim()) { this.uploadErrors['name'] = 'Document name is required.'; }
    if (!this.uploadForm.fileName)    { this.uploadErrors['fileName'] = 'Please select a file.'; }
    if (Object.keys(this.uploadErrors).length > 0) return;

    const vendorId = sessionStorage.getItem('userid') || '';
    this.vendorService.uploadDocument(vendorId, {
      name:        this.uploadForm.name.trim(),
      category:    this.uploadForm.category,
      fileUrl:     '#',
      fileName:    this.uploadForm.fileName,
      fileSize:    this.uploadForm.fileSize || '—',
      fileType:    this.uploadForm.fileType,
      expiryDate:  this.uploadForm.expiryDate ? new Date(this.uploadForm.expiryDate) : undefined,
      notes:       this.uploadForm.notes || undefined,
      isRequired:  this.uploadForm.isRequired,
    }).subscribe();

    this.vendorService.getDocumentStats().pipe(take(1)).subscribe(s => this.stats = s);
    this.closeUploadModal();
  }

  // ── Delete ────────────────────────────────────────────────────────────────────
  openDeleteConfirm(doc: VendorDocument, e: MouseEvent): void {
    e.stopPropagation();
    this.docToDelete = doc; this.showDeleteConfirm = true;
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
    console.log('[Documents] Download:', doc.fileName);
  }

  // ── Formatting ────────────────────────────────────────────────────────────────
  fmtDate(d: Date | undefined): string {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-NG', { day: '2-digit', month: 'short', year: 'numeric' });
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

  statusLabel(status: DocumentStatus): string {
    const m: Record<DocumentStatus, string> = {
      active: 'Active', expiring_soon: 'Expiring Soon',
      expired: 'Expired', pending_review: 'Pending Review',
    };
    return m[status] ?? status;
  }

  categoryLabel(cat: DocumentCategory): string {
    const m: Record<DocumentCategory, string> = {
      registration: 'Registration', tax: 'Tax', licence: 'Licence',
      insurance: 'Insurance', certification: 'Certification', other: 'Other',
    };
    return m[cat] ?? cat;
  }

  categoryIcon(cat: DocumentCategory): string {
    const m: Record<DocumentCategory, string> = {
      registration: '🏢', tax: '🧾', licence: '📋',
      insurance: '🛡️', certification: '🎖️', other: '📄',
    };
    return m[cat] ?? '📄';
  }
}
// product-bulk-import.component.ts
// ============================================================
// IMPORTS
// ============================================================

import { Component, OnInit, OnDestroy, Output, EventEmitter } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import * as XLSX from 'xlsx';
import { InventoryService } from '../../../../service/inventory/inventory.service';
import { Product, Category, MeasurementUnit, Supplier } from '../../../../domain/inventory/inventory.dto';

// ============================================================
// COMPONENT
// ============================================================

@Component({
  selector: 'app-product-bulk-import',
  templateUrl: './product-bulk-import.component.html',
  styleUrls: ['./product-bulk-import.component.scss']
})
export class ProductBulkImportComponent implements OnInit, OnDestroy {

  // ============================================================
  // OUTPUTS
  // ============================================================

  @Output() completed = new EventEmitter<Product[]>();
  @Output() cancelled = new EventEmitter<void>();

  // ============================================================
  // STATE
  // ============================================================

  // Data
  categories: Category[] = [];
  measurementUnits: MeasurementUnit[] = [];
  suppliers: Supplier[] = [];
  /** All existing products, used to resolve "Overwrite existing" by SKU during import. */
  existingProducts: Product[] = [];

  // UI
  Math = Math;
  Object = Object;
  currentStep: number = 1;
  totalSteps: number = 3;
  isLoading: boolean = true;
  isUploading: boolean = false;
  isProcessing: boolean = false;
  error: string | null = null;
  fileName: string = '';

  // File upload
  selectedFile: File | null = null;
  fileContent: string = '';
  parsedData: any[] = [];
  previewData: any[] = [];
  importResults: {
    total: number;
    successful: number;
    failed: number;
    errors: { row: number; message: string }[];
  } | null = null;
  /** The actual saved products from this run, so the completion screen can link straight to
   *  them — otherwise they just land somewhere in the full (alphabetically-sorted, paginated)
   *  product list with no indication of where. */
  createdProducts: Product[] = [];

  // Form
  importForm: FormGroup;

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
    this.importForm = this.buildForm();
  }

  // ============================================================
  // LIFECYCLE HOOKS
  // ============================================================

  ngOnInit(): void {
    this.loadData();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ============================================================
  // FORM BUILDING
  // ============================================================

  private buildForm(): FormGroup {
    return this.fb.group({
      defaultCategory: [''],
      defaultUnit: ['EACH'],
      defaultSupplier: [''],
      overwriteExisting: [false],
      skipErrors: [false],
      validateOnly: [false]
    });
  }

  // ============================================================
  // DATA LOADING
  // ============================================================

  loadData(): void {
    this.isLoading = true;

    // Load categories
    this.inventoryService.getCategories()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (categories) => {
          this.categories = categories;
          this.isLoading = false;
        },
        error: (err) => {
          console.error('Failed to load categories:', err);
          this.error = 'Failed to load categories. Please try again.';
          this.isLoading = false;
        }
      });

    // Load measurement units
    this.inventoryService.getMeasurementUnits()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (units) => {
          this.measurementUnits = units;
        },
        error: (err) => {
          console.error('Failed to load measurement units:', err);
        }
      });

    // Load suppliers
    this.inventoryService.getSuppliers()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (suppliers) => {
          this.suppliers = suppliers;
        },
        error: (err) => {
          console.error('Failed to load suppliers:', err);
        }
      });

    // Load all existing products (unpaginated) so "Overwrite existing" can match by SKU
    this.inventoryService.getProducts({ limit: 100000 })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.existingProducts = res.data;
        },
        error: (err) => {
          console.error('Failed to load existing products:', err);
        }
      });
  }

  // ============================================================
  // FILE HANDLING
  // ============================================================

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    this.selectedFile = input.files[0];
    this.fileName = this.selectedFile.name;
    this.error = null;
    this.readFile(this.selectedFile);
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    const target = event.currentTarget as HTMLElement;
    target.classList.add('ql-upload-zone--dragover');
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    const target = event.currentTarget as HTMLElement;
    target.classList.remove('ql-upload-zone--dragover');
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    const target = event.currentTarget as HTMLElement;
    target.classList.remove('ql-upload-zone--dragover');

    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      this.selectedFile = files[0];
      this.fileName = this.selectedFile.name;
      this.error = null;
      this.readFile(this.selectedFile);
    }
  }

  /** Dispatches to the CSV/TSV text parser or the Excel binary parser based on file extension. */
  private readFile(file: File): void {
    const isExcel = /\.xlsx?$/i.test(file.name);

    if (isExcel) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          const sheet = workbook.Sheets[firstSheetName];
          // header:1 gives an array-of-arrays (row 0 = headers) so we can reuse the same
          // header/row processing pipeline as the CSV path.
          const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: '' });
          this.processRows(rows);
        } catch (err) {
          console.error('Error parsing Excel file:', err);
          this.error = 'Failed to read Excel file. Please ensure it is a valid .xlsx or .xls file.';
          this.isProcessing = false;
        }
      };
      reader.onerror = () => {
        this.error = 'Failed to read the file.';
        this.isProcessing = false;
      };
      reader.readAsArrayBuffer(file);
    } else {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        this.fileContent = content;
        this.parseFile(content);
      };
      reader.onerror = () => {
        this.error = 'Failed to read the file.';
        this.isProcessing = false;
      };
      reader.readAsText(file);
    }
  }

  removeFile(): void {
    this.selectedFile = null;
    this.fileName = '';
    this.fileContent = '';
    this.parsedData = [];
    this.previewData = [];
    this.error = null;
    const input = document.getElementById('fileInput') as HTMLInputElement;
    if (input) input.value = '';
  }

  // ============================================================
  // FILE PARSING
  // ============================================================

  parseFile(content: string): void {
    this.isProcessing = true;
    this.error = null;

    try {
      // Try to parse as CSV or TSV
      const lines = content.split(/\r?\n/).filter(line => line.trim());
      if (lines.length === 0) {
        this.error = 'File is empty. Please upload a valid CSV file.';
        this.isProcessing = false;
        return;
      }

      // Detect delimiter (comma or tab)
      const hasTab = lines[0].includes('\t');
      const delimiter = hasTab ? '\t' : ',';
      const rows = lines.map(line => this.parseCSVLine(line, delimiter));

      this.processRows(rows);
    } catch (err) {
      console.error('Error parsing file:', err);
      this.error = 'Failed to parse file. Please ensure it is a valid CSV file.';
      this.isProcessing = false;
    }
  }

  /**
   * Shared row-processing pipeline for both the CSV/TSV path (parseFile) and the Excel path
   * (readFile) — both end up producing a plain array-of-arrays (row 0 = headers) before reaching here.
   */
  private processRows(rows: any[][]): void {
    try {
      const nonEmptyRows = rows.filter(r => r.some(cell => String(cell ?? '').trim() !== ''));
      if (nonEmptyRows.length === 0) {
        this.error = 'File is empty. Please upload a file with data.';
        this.isProcessing = false;
        return;
      }

      // Normalize headers by stripping whitespace and lowercasing (e.g. "Selling Price" -> "sellingprice")
      const rawHeaders = nonEmptyRows[0].map(h => String(h ?? ''));
      const normalizedHeaders = rawHeaders.map(h => h.toLowerCase().trim().replace(/\s/g, ''));

      // Only these are truly required to build a valid product — every other template column
      // (description, category, cost price, quantity, unit, weight, supplier) is optional.
      const requiredHeaders = ['name', 'sku', 'sellingprice'];
      const missingHeaders = requiredHeaders.filter(h => !normalizedHeaders.includes(h));

      if (missingHeaders.length > 0) {
        this.error = `Missing required columns: ${missingHeaders.join(', ')}. Download the template for the full list of supported columns.`;
        this.isProcessing = false;
        return;
      }

      const data: any[] = [];
      const errors: { row: number; message: string }[] = [];

      for (let i = 1; i < nonEmptyRows.length; i++) {
        const values = nonEmptyRows[i];
        const row: any = {};
        normalizedHeaders.forEach((key, index) => {
          const value = values[index];
          row[key] = value !== undefined && value !== null ? String(value).trim() : '';
        });

        const rowErrors = this.validateRow(row, i + 1);
        if (rowErrors.length > 0) {
          errors.push(...rowErrors);
          continue;
        }

        data.push(row);
      }

      this.parsedData = data;
      this.previewData = data.slice(0, 10); // Show first 10 rows in preview

      if (data.length === 0) {
        this.error = errors.length > 0
          ? `No valid rows found — row ${errors[0].row}: ${errors[0].message}`
          : 'No valid rows found in the file. Please check your data.';
      }

      this.isProcessing = false;

      // If data is valid, move to step 2
      if (data.length > 0) {
        this.currentStep = 2;
      }
    } catch (err) {
      console.error('Error processing file data:', err);
      this.error = 'Failed to process file data.';
      this.isProcessing = false;
    }
  }

  private parseCSVLine(line: string, delimiter: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === delimiter && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());

    return result;
  }

  private validateRow(row: any, rowNumber: number): { row: number; message: string }[] {
    const errors: { row: number; message: string }[] = [];

    if (!row.name) {
      errors.push({ row: rowNumber, message: 'Name is required' });
    }

    if (!row.sku) {
      errors.push({ row: rowNumber, message: 'SKU is required' });
    }

    if (!row.sellingprice || isNaN(parseFloat(row.sellingprice)) || parseFloat(row.sellingprice) < 0) {
      errors.push({ row: rowNumber, message: 'Selling price must be a positive number' });
    }

    if (row.costprice && isNaN(parseFloat(row.costprice))) {
      errors.push({ row: rowNumber, message: 'Cost price must be a number' });
    }

    if (row.quantity && isNaN(parseInt(row.quantity))) {
      errors.push({ row: rowNumber, message: 'Quantity must be a number' });
    }

    if (row.weight && isNaN(parseFloat(row.weight))) {
      errors.push({ row: rowNumber, message: 'Weight must be a number' });
    }

    if (row.category && !this.categories.some(c => c.name.toLowerCase() === row.category.toLowerCase())) {
      // Warning, not error - will use default category
    }

    return errors;
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
        if (!this.selectedFile) {
          this.error = 'Please select a file to import';
          return false;
        }
        if (this.parsedData.length === 0) {
          this.error = 'No valid data found in the file';
          return false;
        }
        return true;
      default:
        return true;
    }
  }

  // ============================================================
  // IMPORT EXECUTION
  // ============================================================

  executeImport(): void {
    this.isProcessing = true;
    this.error = null;

    const formValue = this.importForm.value;
    const rows = this.parsedData;
    const total = rows.length;
    const errors: { row: number; message: string }[] = [];
    let successful = 0;
    let failed = 0;
    this.createdProducts = [];

    if (formValue.validateOnly) {
      // Rows here already passed per-row validation in processRows(), so with no rows to
      // actually save, everything that got this far "would" import successfully.
      this.importResults = { total, successful: total, failed: 0, errors: [] };
      this.isProcessing = false;
      this.currentStep = 3;
      return;
    }

    // NOTE: InventoryService's createProduct/updateProduct are a localStorage-backed mock and
    // resolve synchronously (via `of(...)`), so this plain for-loop completes in one tick — no
    // recursion/concatMap needed. If the service is ever swapped for real HTTP calls, this loop
    // will need to become a proper async sequence (e.g. concatMap) instead.
    for (let index = 0; index < rows.length; index++) {
      const row = rows[index];
      const rowNumber = index + 2; // +1 for the header row, +1 for 1-based row numbering
      const productData = this.mapRowToProduct(row, formValue);

      const existing = formValue.overwriteExisting && productData.sku
        ? this.existingProducts.find(p => p.sku?.toLowerCase() === String(productData.sku).toLowerCase())
        : undefined;

      const action = existing
        ? this.inventoryService.updateProduct(existing.id, productData)
        : this.inventoryService.createProduct(productData);

      let rowFailed = false;
      let rowErrorMessage = '';

      action.subscribe({
        next: (saved) => {
          successful++;
          this.createdProducts.push(saved);
          if (!existing) {
            this.existingProducts.push(saved);
          }
        },
        error: (err) => {
          rowFailed = true;
          rowErrorMessage = err?.message || 'Failed to save product';
        }
      });

      if (rowFailed) {
        failed++;
        errors.push({ row: rowNumber, message: rowErrorMessage });
        if (!formValue.skipErrors) {
          const remaining = rows.length - (index + 1);
          if (remaining > 0) {
            errors.push({ row: rowNumber, message: `Import stopped — ${remaining} remaining row(s) were not attempted. Enable "Skip errors" to import the rest anyway.` });
          }
          break;
        }
      }
    }

    this.importResults = { total, successful, failed, errors };
    this.isProcessing = false;
    this.currentStep = 3;
  }

  private mapRowToProduct(row: any, formValue: any): Partial<Product> {
    const category = row.category
      ? this.categories.find(c => c.name.toLowerCase() === row.category.toLowerCase())
      : undefined;

    const unitName = row.unitofmeasure || formValue.defaultUnit || 'pcs';
    const unit = this.measurementUnits.find(u => u.name.toLowerCase() === String(unitName).toLowerCase())
      || this.measurementUnits.find(u => u.id === formValue.defaultUnit);

    const supplier = row.supplier
      ? this.suppliers.find(s => s.name.toLowerCase() === row.supplier.toLowerCase())
      : undefined;
    const supplierIds = supplier
      ? [supplier.id]
      : (formValue.defaultSupplier ? [formValue.defaultSupplier] : []);

    const quantity = parseInt(row.quantity, 10) || 0;

    return {
      name: row.name,
      sku: row.sku,
      description: row.description || '',
      category: category?.id || formValue.defaultCategory || undefined,
      unitOfMeasure: (unit?.id || 'EACH') as any,
      sellingPrice: parseFloat(row.sellingprice) || 0,
      costPrice: parseFloat(row.costprice) || 0,
      stockQuantity: quantity,
      weight: parseFloat(row.weight) || 0,
      status: quantity > 0 ? 'ACTIVE' as any : 'OUT_OF_STOCK' as any,
      supplierIds
    };
  }

  // ============================================================
  // NAVIGATION
  // ============================================================

  goBack(): void {
    this.cancelled.emit();
    if (!this.cancelled.observed) {
      this.navigateToProducts();
    }
  }

  finishImport(): void {
    this.completed.emit(this.parsedData.map(row => this.mapRowToProduct(row, this.importForm.value)) as Product[]);
    if (!this.completed.observed) {
      this.navigateToProducts();
    }
  }

  /** Falls back to the product list when nothing is listening to completed/cancelled — this component is currently only ever routed to directly, never embedded. */
  private navigateToProducts(): void {
    const uuid = this.route.snapshot.paramMap.get('uuid');
    if (uuid) {
      this.router.navigate(['/admin/sales/commerce/inventory', uuid]);
    } else {
      this.router.navigate(['/admin/sales/commerce/inventory']);
    }
  }

  /** Jump straight to one just-imported product's detail page — the full product list is
   *  alphabetically sorted and paginated, so a freshly imported batch can easily land on a
   *  later page with no visual cue that the import actually worked. */
  viewCreatedProduct(productId: string | number): void {
    this.router.navigate(['/admin/sales/commerce/inventory/products', String(productId)]);
  }

  // ============================================================
  // UTILITY HELPERS
  // ============================================================

  getStepStatus(step: number): 'complete' | 'current' | 'incomplete' {
    if (step < this.currentStep) return 'complete';
    if (step === this.currentStep) return 'current';
    return 'incomplete';
  }

  getFileSize(size: number): string {
    if (size < 1024) return size + ' B';
    if (size < 1024 * 1024) return (size / 1024).toFixed(1) + ' KB';
    return (size / (1024 * 1024)).toFixed(1) + ' MB';
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

  getColumnName(key: string): string {
    const map: Record<string, string> = {
      'name': 'Product Name',
      'sku': 'SKU',
      'category': 'Category',
      'sellingprice': 'Selling Price',
      'costprice': 'Cost Price',
      'quantity': 'Quantity',
      'description': 'Description',
      'unitofmeasure': 'Unit of Measure',
      'weight': 'Weight',
      'supplier': 'Supplier'
    };
    return map[key] || key;
  }

  // ============================================================
  // TEMPLATE DOWNLOAD
  // ============================================================

  /** Column headers offered in the downloadable template — normalize (lowercase, no spaces) to
   *  exactly the row keys `processRows()`/`mapRowToProduct()` expect, covering the majority of
   *  fields on the Add/Edit Product form. */
  private readonly TEMPLATE_HEADERS = [
    'Name', 'Description', 'SKU', 'Category', 'Cost Price', 'Selling Price', 'Quantity', 'Unit Of Measure', 'Weight', 'Supplier'
  ];

  private readonly TEMPLATE_SAMPLE_ROWS: (string | number)[][] = [
    ['Portland Cement 50kg Bag', 'High-strength Portland-limestone cement, 50kg bag', 'CEM-001', 'Building Materials', 6000, 7000, 100, 'EACH', 50, 'Dangote Cement Factory'],
    ['Ceiling Fan 56-inch White', 'Three-blade ceiling fan with light kit, 56-inch sweep', 'ELC-FAN-56W', 'Electrical', 18000, 25000, 40, 'EACH', 4, 'Alibaba Group']
  ];

  downloadTemplate(format: 'csv' | 'xlsx'): void {
    const rows = [this.TEMPLATE_HEADERS, ...this.TEMPLATE_SAMPLE_ROWS];

    if (format === 'xlsx') {
      const worksheet = XLSX.utils.aoa_to_sheet(rows);
      worksheet['!cols'] = this.TEMPLATE_HEADERS.map(() => ({ wch: 22 }));
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Products');
      XLSX.writeFile(workbook, 'product_import_template.xlsx');
      return;
    }

    const escapeCsvCell = (value: string | number): string => {
      const str = String(value ?? '');
      return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
    };
    const csvContent = rows.map(row => row.map(escapeCsvCell).join(',')).join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'product_import_template.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  isStepValid(step: number): boolean {
    switch (step) {
      case 1:
        return !!this.selectedFile && this.parsedData.length > 0;
      default:
        return true;
    }
  }

  getSuccessRate(): number {
    if (!this.importResults || this.importResults.total === 0) return 0;
    return (this.importResults.successful / this.importResults.total) * 100;
  }
}
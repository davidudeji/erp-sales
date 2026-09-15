// procurement-product-form/procurement-product-form.component.ts

import { Component, EventEmitter, Output, Input, OnChanges, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, FormArray, Validators, AbstractControl, ValidatorFn } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { RequestItem, RFQAttachment, ProcurementCategory } from '../../../domain/procurement-request/procurement.dto';
import { ProcurementRequestService } from '../../../service/procurement/procurement.service';
import { SalesService } from '../../../service/sales/sales.service';
import { parseIdToNumber } from '../../../service/procurement/rfq-quotation-bridge.util';
import { v4 as uuidV4 } from 'uuid';
import { MessageService } from 'primeng/api';

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
  selector: 'app-request-for-quotation-form',
  templateUrl: './request-for-quotation-form.component.html',
  styleUrl: './request-for-quotation-form.component.scss'
})
export class RequestForQuotationFormComponent implements OnChanges, OnInit {
  @Input() initialData: any = {};
  @Output() formData = new EventEmitter<any>();
  @Output() back = new EventEmitter<void>();

  productForm: FormGroup;
  currencies = ['NGN', 'USD', 'EUR', 'GBP'];
  units: string[] = [];
  procurementCategories: ProcurementCategory[] = [];
  isEditMode = false;
  requestId: string | null = null;
  isLookingUp: { [key: number]: boolean } = {};

  // Custom Category and Unit Modal States
  showAddCategoryModal = false;
  showAddUnitModal = false;
  newCategoryName = '';
  newCategoryDesc = '';
  newUnitName = '';
  activeItemIndexForModal = 0;

  get todayDateString(): string {
    return new Date().toISOString().split('T')[0];
  }

  constructor(
    private messageService: MessageService,
    private fb: FormBuilder,
    private router: Router,
    private route: ActivatedRoute,
    private procurementRequestService: ProcurementRequestService,
    private salesService: SalesService
  ) {
    this.productForm = this.fb.group({
      title: ['', [Validators.required, Validators.minLength(5)]],
      description: ['', [Validators.required, Validators.minLength(20)]],
      items: this.fb.array([]),
      specialInstructions: ['']
    });

    // Add initial item
    this.addItem();
  }

  ngOnInit(): void {
    this.loadCategoriesAndUnits();

    this.route.paramMap.subscribe(params => {
      const uuid = params.get('uuid');
      if (uuid) {
        this.isEditMode = true;
        this.requestId = uuid;
        this.loadRequest(uuid);
      }
    });
  }

  loadCategoriesAndUnits(): void {
    // Load category arrays from both sources and merge them
    this.procurementRequestService.getProcurementCategories().subscribe({
      next: (cats) => {
        this.salesService.getCategories().subscribe({
          next: (salesCats) => {
            const merged = [...cats];
            salesCats.forEach(sc => {
              const exists = merged.some(mc => mc.categoryId === sc.categoryId || mc.name.toLowerCase() === sc.name.toLowerCase());
              if (!exists) {
                merged.push({
                  id: sc.id,
                  categoryId: sc.categoryId || `CAT-${sc.id}`,
                  name: sc.name,
                  description: sc.description || ''
                });
              }
            });
            this.procurementCategories = merged;
          },
          error: () => {
            this.procurementCategories = cats;
          }
        });
      }
    });

    // Load units from salesService without relying on hard-coded defaults
    this.salesService.getMeasurementUnits().subscribe({
      next: (salesUnits) => {
        this.units = salesUnits
          .map(su => su?.name?.trim())
          .filter((name): name is string => Boolean(name));
      },
      error: () => {
        this.units = [];
      }
    });
  }


  loadRequest(uuid: string): void {
    this.procurementRequestService.getRequest(parseIdToNumber(uuid)).subscribe({
      next: (req) => {
        if (req) {
          // Clear any initial item pushed in constructor
          while (this.items.length) {
            this.items.removeAt(0);
          }

          // Populate items array
          if (req.items && req.items.length > 0) {
            req.items.forEach(item => {
              const itemGroup = this.createItemForm();

              // Clear custom fields array in specifications
              const specsGroup = itemGroup.get('specifications') as FormGroup;
              const customFields = specsGroup.get('customFields') as FormArray;
              while (customFields.length) {
                customFields.removeAt(0);
              }
              const specs = item.specifications as any;
              if (specs?.customFields) {
                specs.customFields.forEach((field: any) => {
                  customFields.push(this.fb.group({
                    label: [field.label, Validators.required],
                    value: [field.value, Validators.required]
                  }));
                });
              }

              // Clear attachments array
              const attachments = itemGroup.get('attachments') as FormArray;
              while (attachments.length) {
                attachments.removeAt(0);
              }
              if (item.attachments) {
                item.attachments.forEach((att: any) => {
                  attachments.push(this.fb.group({
                    id: [att.id],
                    fileName: [att.fileName, Validators.required],
                    fileUrl: [att.fileUrl],
                    size: [att.size],
                    type: [att.type],
                    uploadedAt: [att.uploadedAt],
                    file: [att.file]
                  }));
                });
              }

              // Patch remaining item values
              itemGroup.patchValue({
                id: item.id,
                name: item.name,
                description: item.description,
                categoryId: (item as any).categoryId || item.category?.categoryId || '',
                partNumber: (item as any).partNumber || '',
                quantity: item.quantity,
                unit: item.unit,
                estimatedBudget: item.estimatedBudget,
                unitPrice: item.unitPrice,
                currency: item.currency || req.currency || 'NGN',
                deliveryMode: item.deliveryMode || 'STANDARD',
                deliveryDeadline: this.parseDateSafe((item as any).deliveryDeadline),
                deliveryLocation: item.deliveryLocation || '',
                specifications: {
                  brand: specs?.brand || '',
                  model: specs?.model || '',
                  color: specs?.color || '',
                  size: specs?.size || '',
                  material: specs?.material || '',
                  warranty: specs?.warranty || ''
                }
              });

              this.items.push(itemGroup);
            });
          }

          // Patch general form values
          this.productForm.patchValue({
            title: req.title,
            description: req.description,
            specialInstructions: req.specialInstructions || ''
          });
        } else {
          this.isEditMode = false;
        }
      },
      error: (err) => {
        console.warn('Request not found in database, treating as new request draft.', err);
        this.isEditMode = false;
        this.messageService.add({
          severity: 'error', summary: 'Error',
          detail: 'Could not load your saved request details — the earlier save may have failed. Please re-enter them.'
        });
      }
    });
  }

  ngOnChanges(): void {
    if (this.initialData) {
      this.productForm.patchValue(this.initialData);
    }
  }

  get items(): FormArray {
    return this.productForm.get('items') as FormArray;
  }

  createItemForm(): FormGroup {
    return this.fb.group({
      id: [this.generateId()],
      name: ['', [Validators.required, Validators.minLength(3)]],
      description: ['', Validators.required],
      categoryId: ['', Validators.required],
      partNumber: [''],
      quantity: [1, [Validators.required, Validators.min(1)]],
      unit: ['', Validators.required],
      estimatedBudget: [null, [Validators.required, Validators.min(0.01)]],
      unitPrice: [null, [Validators.min(0.01)]],
      currency: ['NGN', Validators.required],
      deliveryMode: ['STANDARD', Validators.required],
      deliveryDeadline: ['', [Validators.required, futureDateValidator()]],
      deliveryLocation: ['', Validators.required],
      specifications: this.fb.group({
        brand: [''],
        model: [''],
        color: [''],
        size: [''],
        material: [''],
        warranty: [''],
        customFields: this.fb.array([])
      }),
      attachments: this.fb.array([])
    });
  }

  addItem(): void {
    this.items.push(this.createItemForm());
  }

  removeItem(index: number): void {
    if (this.items.length > 1) {
      this.items.removeAt(index);
    }
  }

  addCustomField(itemIndex: number): void {
    const customFields = this.items.at(itemIndex).get('specifications.customFields') as FormArray;
    customFields.push(this.fb.group({
      key: ['', Validators.required],
      value: ['', Validators.required]
    }));
  }

  removeCustomField(itemIndex: number, fieldIndex: number): void {
    const customFields = this.items.at(itemIndex).get('specifications.customFields') as FormArray;
    customFields.removeAt(fieldIndex);
  }

  onFileUpload(event: Event, itemIndex: number): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const attachments = this.items.at(itemIndex).get('attachments') as FormArray;
      Array.from(input.files).forEach(file => {
        const attachment = this.fb.group({
          id: [this.generateId()],
          fileName: [file.name],
          fileUrl: [URL.createObjectURL(file)],
          size: [file.size],
          type: [file.type],
          uploadedAt: [new Date()],
          file: [file]
        });
        attachments.push(attachment);
      });
    }
    input.value = '';
  }

  removeAttachment(itemIndex: number, attachmentIndex: number): void {
    const attachments = this.items.at(itemIndex).get('attachments') as FormArray;
    attachments.removeAt(attachmentIndex);
  }

  getTotalBudget(): number {
    return this.items.controls.reduce((total, item) => {
      const budget = item.get('estimatedBudget')?.value || 0;
      return total + budget;
    }, 0);
  }

  private generateId(): string {
    return Math.random().toString(36).substring(2, 11);
  }

  private parseDateSafe(val: any): string {
    if (!val) return '';
    const d = new Date(val);
    if (isNaN(d.getTime()) || d.getFullYear() < 2000) return '';
    return d.toISOString().substring(0, 10);
  }

  onNext(): void {
    if (this.productForm.valid) {
      const formValue = this.productForm.value;
      formValue.totalBudget = this.getTotalBudget();
      formValue.procurementType = 'PRODUCT';

      if (formValue.items && Array.isArray(formValue.items)) {
        // Send categoryId only — the backend expects a plain FK reference here,
        // not a nested category object (that shape crashes deserialization).
        // The readable name is looked up locally via procurementCategories when
        // it's needed for display (e.g. vendor-suggestion matching).
        formValue.items = formValue.items.map((it: any) => {
          const { category, ...rest } = it;
          return {
            ...rest,
            deliveryDeadline: it.deliveryDeadline ? new Date(it.deliveryDeadline).toISOString() : null
          };
        });
      }

      const firstItem = formValue.items && formValue.items[0];
      if (firstItem) {
        formValue.currency = firstItem.currency || 'NGN';
        formValue.deliveryMode = firstItem.deliveryMode || 'STANDARD';
        formValue.deliveryLocation = firstItem.deliveryLocation || '';
        formValue.deliveryDeadline = firstItem.deliveryDeadline ? new Date(firstItem.deliveryDeadline) : new Date();
      }

      if (this.isEditMode && this.requestId) {
        this.procurementRequestService.updateRequest(parseIdToNumber(this.requestId), formValue).subscribe({
          next: (req: any) => {
            const savedId = req?.id || this.requestId;
            this.requestId = String(savedId);
            this.router.navigate(['/admin/sales/commerce/requests/new/product', savedId, 'template']);
          },
          error: (err) => {
            console.error('Failed to update request', err);
            this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to save request details. Please try again.' });
          }
        });
      } else {
        this.procurementRequestService.createRequest(formValue).subscribe({
          next: (req: any) => {
            const savedId = req?.id;
            this.requestId = String(savedId);
            this.isEditMode = true;
            this.router.navigate(['/admin/sales/commerce/requests/new/product', savedId, 'template']);
          },
          error: (err) => {
            console.error('Failed to create request', err);
            this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to save request details. Please try again.' });
          }
        });
      }
    } else {
      this.markFormGroupTouched(this.productForm);
    }
  }

  saveDraft(): void {
    const formValue = this.productForm.value;
    formValue.totalBudget = this.getTotalBudget();
    formValue.procurementType = 'PRODUCT';
    formValue.status = 'DRAFT';

    if (formValue.items && Array.isArray(formValue.items)) {
      // See onNext() — the backend rejects a nested category object, categoryId alone is enough.
      formValue.items = formValue.items.map((it: any) => {
        const { category, ...rest } = it;
        return {
          ...rest,
          deliveryDeadline: it.deliveryDeadline ? new Date(it.deliveryDeadline).toISOString() : null
        };
      });
    }

    const firstItem = formValue.items && formValue.items[0];
    if (firstItem) {
      formValue.currency = firstItem.currency || 'NGN';
      formValue.deliveryMode = firstItem.deliveryMode || 'STANDARD';
      formValue.deliveryLocation = firstItem.deliveryLocation || '';
      formValue.deliveryDeadline = firstItem.deliveryDeadline ? new Date(firstItem.deliveryDeadline) : new Date();
    }

    if (!formValue.title || !formValue.title.trim()) {
      formValue.title = `Draft Product Request - ${new Date().toLocaleDateString()}`;
    }

    if (this.isEditMode && this.requestId) {
      this.procurementRequestService.updateRequest(parseIdToNumber(this.requestId), formValue).subscribe({
        next: () => { this.router.navigate(['/admin/sales/commerce/requests']); },
        error: (err) => {
          console.error('Failed to update request draft', err);
          this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to save draft. Please try again.' });
        }
      });
    } else {
      this.procurementRequestService.createRequest({ ...formValue, status: 'DRAFT' }).subscribe({
        next: (req: any) => {
          if (req?.id) { this.requestId = String(req.id); this.isEditMode = true; }
          this.router.navigate(['/admin/sales/commerce/requests']);
        },
        error: (err) => {
          console.error('Failed to create request draft', err);
          this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to save draft. Please try again.' });
        }
      });
    }
  }

  onBack(): void {
    this.back.emit();
  }

  private markFormGroupTouched(formGroup: FormGroup): void {
    Object.values(formGroup.controls).forEach(control => {
      control.markAsTouched();
      if (control instanceof FormGroup) {
        this.markFormGroupTouched(control);
      } else if (control instanceof FormArray) {
        control.controls.forEach(c => {
          if (c instanceof FormGroup) {
            this.markFormGroupTouched(c);
          }
        });
      }
    });
  }

  getFormErrorMessage(controlName: string): string {
    const control = this.productForm.get(controlName);
    if (control && control.errors) {
      if (control.errors['required']) return 'This field is required';
      if (control.errors['minlength']) return `Minimum ${control.errors['minlength'].requiredLength} characters required`;
      if (control.errors['min']) return 'Value must be greater than 0';
    }
    return '';
  }

  getItemErrorMessage(itemIndex: number, fieldName: string): string {
    const item = this.items.at(itemIndex);
    const control = item.get(fieldName);
    if (control && control.errors) {
      if (control.errors['required']) return 'This field is required';
      if (control.errors['minlength']) return `Minimum ${control.errors['minlength'].requiredLength} characters required`;
      if (control.errors['min']) return 'Value must be greater than 0';
      if (control.errors['pastDate']) return 'Date cannot be in the past';
    }
    return '';
  }

  formatCurrency(value: number): string {
    const currency = this.productForm.get('currency')?.value || 'NGN';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency
    }).format(value || 0);
  }

  getFileIcon(fileType: string): string {
    if (!fileType) return 'fa-file';
    if (fileType.includes('pdf')) return 'fa-file-pdf';
    if (fileType.includes('image')) return 'fa-file-image';
    if (fileType.includes('excel') || fileType.includes('spreadsheet') || fileType.includes('csv')) return 'fa-file-excel';
    if (fileType.includes('word') || fileType.includes('document')) return 'fa-file-word';
    return 'fa-file';
  }

  formatFileSize(size: number): string {
    if (!size) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(size) / Math.log(k));
    return parseFloat((size / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  lookupProductByPartNumber(index: number): void {
    const item = this.items.at(index);
    const partNumber = item.get('partNumber')?.value;
    if (!partNumber || !partNumber.trim()) {
      this.messageService.add({ severity: 'warn', summary: 'Warning', detail: 'Please enter a part or serial number to look up.' });
      return;
    }

    this.isLookingUp[index] = true;

    this.salesService.getProducts({ sku: partNumber.trim(), page: 0, size: 1 }).subscribe({
      next: (result) => {
        this.isLookingUp[index] = false;
        const product = result.data && result.data[0];
        if (!product) {
          this.messageService.add({ severity: 'info', summary: 'Notice', detail: `No product found for part number: "${partNumber}"` });
          return;
        }
        const specs = (product as any).specifications || {};
        item.patchValue({
          name: product.name,
          description: product.description,
          unit: product.measurementUnit?.name || 'Pieces',
          estimatedBudget: product.unitPrice || 0,
          unitPrice: product.unitPrice || 0,
          specifications: {
            brand: specs.brand || '',
            model: specs.model || product.code || '',
            color: specs.color || '',
            size: specs.size || '',
            material: specs.material || '',
            warranty: specs.warranty || ''
          }
        });
        this.messageService.add({ severity: 'success', summary: 'Success', detail: `Product details successfully retrieved for: "${partNumber}"` });
      },
      error: (err) => {
        this.isLookingUp[index] = false;
        console.error('Error looking up product by part number:', err);
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Could not retrieve product details. Please fill in the fields manually.' });
      }
    });
  }

  onCategoryChange(event: Event, index: number): void {
    if ((event.target as HTMLSelectElement).value === '__add_category__') {
      this.items.at(index).get('categoryId')?.setValue('', { emitEvent: false });
      this.openAddCategoryModal(index);
    }
  }

  onUnitChange(event: Event, index: number): void {
    if ((event.target as HTMLSelectElement).value === '__add_unit__') {
      this.items.at(index).get('unit')?.setValue('', { emitEvent: false });
      this.openAddUnitModal(index);
    }
  }

  openAddCategoryModal(index: number): void {
    this.activeItemIndexForModal = index;
    this.newCategoryName = '';
    this.newCategoryDesc = '';
    this.showAddCategoryModal = true;
  }

  closeAddCategoryModal(): void {
    this.showAddCategoryModal = false;
  }

  saveCustomCategory(): void {
    if (!this.newCategoryName.trim()) return;

    const catName = this.newCategoryName.trim();
    const catDesc = this.newCategoryDesc.trim();

    this.salesService.createCategory({
      name: catName,
      description: catDesc
    }).subscribe({
      next: (salesCats) => {
        // Merge with existing procurementCategories
        const merged = [...this.procurementCategories];
        salesCats.forEach(sc => {
          const exists = merged.some(mc => mc.categoryId === sc.categoryId || mc.name.toLowerCase() === sc.name.toLowerCase());
          if (!exists) {
            merged.push({
              id: sc.id,
              categoryId: sc.categoryId || `CAT-${sc.id}`,
              name: sc.name,
              description: sc.description || ''
            });
          }
        });
        this.procurementCategories = merged;

        // Find matched category in this merged list
        const matched = this.procurementCategories.find(c => c.name.toLowerCase() === catName.toLowerCase());
        const item = this.items.at(this.activeItemIndexForModal);
        if (item && matched) {
          item.get('categoryId')?.setValue(matched.categoryId);
        }

        this.closeAddCategoryModal();
        this.messageService.add({ severity: 'success', summary: 'Success', detail: 'Custom category saved and selected successfully.' });
      },
      error: (err) => {
        console.error('Error creating custom category:', err);
        // Fallback local addition if api fails or is offline
        const tempId = `CAT-CUSTOM-${Date.now()}`;
        const newCat = {
          id: Date.now(),
          categoryId: tempId,
          name: catName,
          description: catDesc
        };
        const exists = this.procurementCategories.some(c => c.name.toLowerCase() === catName.toLowerCase());
        if (!exists) {
          this.procurementCategories.push(newCat);
        }
        const matched = this.procurementCategories.find(c => c.name.toLowerCase() === catName.toLowerCase()) || newCat;
        const item = this.items.at(this.activeItemIndexForModal);
        if (item) {
          item.get('categoryId')?.setValue(matched.categoryId);
        }
        this.closeAddCategoryModal();
        this.messageService.add({ severity: 'info', summary: 'Notice', detail: 'Custom category added locally.' });
      }
    });
  }

  openAddUnitModal(index: number): void {
    this.activeItemIndexForModal = index;
    this.newUnitName = '';
    this.showAddUnitModal = true;
  }

  closeAddUnitModal(): void {
    this.showAddUnitModal = false;
  }

  saveCustomUnit(): void {
    if (!this.newUnitName.trim()) return;

    const unitName = this.newUnitName.trim();

    this.salesService.createMeasurementUnit({
      name: unitName,
      code: unitName.substring(0, 3).toLowerCase()
    }).subscribe({
      next: (salesUnits) => {
        // Merge the units array
        salesUnits.forEach(su => {
          if (su.name && !this.units.some(u => u.toLowerCase() === su.name.toLowerCase())) {
            this.units.push(su.name);
          }
        });

        // Find matched unit
        const matched = this.units.find(u => u.toLowerCase() === unitName.toLowerCase()) || unitName;
        const item = this.items.at(this.activeItemIndexForModal);
        if (item) {
          item.get('unit')?.setValue(matched);
        }

        this.closeAddUnitModal();
        this.messageService.add({ severity: 'success', summary: 'Success', detail: 'Custom unit saved and selected successfully.' });
      },
      error: (err) => {
        console.error('Error creating custom unit:', err);
        // Fallback local addition if api fails or is offline
        if (!this.units.some(u => u.toLowerCase() === unitName.toLowerCase())) {
          this.units.push(unitName);
        }
        const matched = this.units.find(u => u.toLowerCase() === unitName.toLowerCase()) || unitName;
        const item = this.items.at(this.activeItemIndexForModal);
        if (item) {
          item.get('unit')?.setValue(matched);
        }
        this.closeAddUnitModal();
        this.messageService.add({ severity: 'info', summary: 'Notice', detail: 'Custom unit added locally.' });
      }
    });
  }
}
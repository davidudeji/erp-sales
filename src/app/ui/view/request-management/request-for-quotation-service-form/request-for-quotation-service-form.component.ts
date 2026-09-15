// request-for-quotation-service-form.component.ts

import { Component, EventEmitter, Output, Input, OnChanges, OnInit, SimpleChanges } from '@angular/core';
import { FormBuilder, FormGroup, FormArray, Validators, AbstractControl, ValidatorFn } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { ProcurementRequestService } from '../../../service/procurement/procurement.service';
import { ProcurementCategory } from '../../../domain/procurement-request/procurement.dto';
import { parseIdToNumber } from '../../../service/procurement/rfq-quotation-bridge.util';
import { v4 as uuidV4 } from 'uuid';

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
  selector: 'app-request-for-quotation-service-form',
  templateUrl: './request-for-quotation-service-form.component.html',
  styleUrl: './request-for-quotation-service-form.component.scss'
})
export class RequestForQuotationServiceFormComponent implements OnChanges, OnInit {
  @Input() initialData: any = {};
  @Output() formData = new EventEmitter<any>();
  @Output() back = new EventEmitter<void>();

  serviceForm: FormGroup;
  currencies = ['NGN', 'USD', 'EUR', 'GBP'];
  procurementCategories: ProcurementCategory[] = [];
  serviceCategories: string[] = [];
  experienceLevels = ['Entry', 'Intermediate', 'Expert', 'Senior'];
  isEditMode = false;
  requestId: string | null = null;
  isLoading = false;
  isNewRequest = true;

  get todayDateString(): string {
    return new Date().toISOString().split('T')[0];
  }

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private route: ActivatedRoute,
    private procurementRequestService: ProcurementRequestService
  ) {
    this.serviceForm = this.fb.group({
      title: ['', [Validators.required, Validators.minLength(5)]],
      description: ['', [Validators.required, Validators.minLength(20)]],
      serviceCategory: ['', Validators.required],
      items: this.fb.array([]),
      specialInstructions: ['']
    });

    this.addItem();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['initialData'] && this.initialData) {
      this.serviceForm.patchValue(this.initialData);
    }
  } // <-- THIS BRACE WAS MISSING

  ngOnInit(): void {
    this.procurementRequestService.getProcurementCategories().subscribe({
      next: (cats) => {
        this.procurementCategories = cats;
        this.serviceCategories = cats.map(c => c.name);
      }
    });

    this.route.paramMap.subscribe(params => {
      const uuid = params.get('uuid');
      if (uuid) {
        this.requestId = uuid;
        this.loadRequest(uuid);
      }
    });
  }

  loadRequest(uuid: string): void {
    this.isLoading = true;
    this.procurementRequestService.getRequest(parseIdToNumber(uuid)).subscribe({
      next: (req) => {
        if (req && req.id) {
          this.isNewRequest = false;
          this.isEditMode = true;
          this.populateForm(req);
        } else {
          this.isNewRequest = true;
          this.isEditMode = false;
        }
        this.isLoading = false;
      },
      error: (err) => {
        console.warn('Request not found, treating as new request.', err);
        this.isNewRequest = true;
        this.isEditMode = false;
        this.isLoading = false;
        
        if (this.requestId && !this.isEditMode) {
          // We're creating a new request with this UUID
        }
      }
    });
  }

  populateForm(req: any): void {
    // Clear any initial item pushed in constructor
    while (this.items.length) {
      this.items.removeAt(0);
    }

    // Populate items array
    if (req.items && req.items.length > 0) {
      req.items.forEach((item: any) => {
        const itemGroup = this.createItemForm();
        
        // Clear requiredQualifications array
        const qualifications = itemGroup.get('requiredQualifications') as FormArray;
        while (qualifications.length) {
          qualifications.removeAt(0);
        }
        if (item.requiredQualifications) {
          item.requiredQualifications.forEach((qual: any) => {
            qualifications.push(this.fb.control(qual, Validators.required));
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
              id: [att.id || this.generateId()],
              fileName: [att.fileName, Validators.required],
              fileUrl: [att.fileUrl],
              size: [att.size],
              type: [att.type],
              uploadedAt: [att.uploadedAt || new Date()],
              file: [att.file]
            }));
          });
        }

        // Patch remaining item values
        itemGroup.patchValue({
          id: item.id || this.generateId(),
          name: item.name || '',
          description: item.description || '',
          categoryId: item.categoryId || item.category?.categoryId || '',
          serviceCategory: item.serviceCategory || '',
          quantity: item.quantity || 1,
          estimatedBudget: item.estimatedBudget || 0,
          currency: item.currency || req.currency || 'NGN',
          deliveryMode: item.deliveryMode || req.deliveryMode || 'STANDARD',
          deliveryDeadline: this.parseDateSafe(item.deliveryDeadline) || this.parseDateSafe(req.deliveryDeadline),
          deliveryLocation: item.deliveryLocation || req.deliveryLocation || '',
          experienceLevel: item.experienceLevel || '',
          serviceDuration: item.serviceDuration || '',
          serviceStartDate: this.parseDateSafe(item.serviceStartDate),
          serviceEndDate: this.parseDateSafe(item.serviceEndDate)
        });

        this.items.push(itemGroup);
      });
    } else {
      // If no items, add a default one
      this.addItem();
    }

    // Patch general form values
    this.serviceForm.patchValue({
      title: req.title || '',
      description: req.description || '',
      serviceCategory: req.serviceCategory || '',
      specialInstructions: req.specialInstructions || ''
    });
  }

  get items(): FormArray {
    return this.serviceForm.get('items') as FormArray;
  }

  createItemForm(): FormGroup {
    return this.fb.group({
      id: [this.generateId()],
      name: ['', [Validators.required, Validators.minLength(3)]],
      description: ['', Validators.required],
      categoryId: ['', Validators.required],
      serviceCategory: ['', Validators.required],
      quantity: [1, [Validators.required, Validators.min(1)]],
      estimatedBudget: [null, [Validators.required, Validators.min(0.01)]],
      currency: ['NGN', Validators.required],
      deliveryMode: ['STANDARD', Validators.required],
      deliveryDeadline: ['', [Validators.required, futureDateValidator()]],
      deliveryLocation: ['', Validators.required],
      experienceLevel: ['', Validators.required],
      serviceDuration: ['', Validators.required],
      serviceStartDate: ['', [Validators.required, futureDateValidator()]],
      serviceEndDate: ['', [Validators.required, futureDateValidator(), dateAfterValidator('serviceStartDate')]],
      requiredQualifications: this.fb.array([]),
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

  addQualification(itemIndex: number): void {
    const qualifications = this.items.at(itemIndex).get('requiredQualifications') as FormArray;
    qualifications.push(this.fb.control('', Validators.required));
  }

  removeQualification(itemIndex: number, qualIndex: number): void {
    const qualifications = this.items.at(itemIndex).get('requiredQualifications') as FormArray;
    qualifications.removeAt(qualIndex);
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
    if (this.serviceForm.valid) {
      const formValue = this.serviceForm.value;
      formValue.totalBudget = this.getTotalBudget();
      formValue.procurementType = 'SERVICE';

      if (formValue.items && Array.isArray(formValue.items)) {
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
            this.router.navigate(['/admin/sales/commerce/requests/new/service', savedId, 'template']);
          },
          error: (err) => {
            console.error('Failed to update request', err);
          }
        });
      } else {
        this.procurementRequestService.createRequest(formValue).subscribe({
          next: (req: any) => {
            const savedId = req?.id;
            this.requestId = String(savedId);
            this.isEditMode = true;
            this.router.navigate(['/admin/sales/commerce/requests/new/service', savedId, 'template']);
          },
          error: (err) => {
            console.error('Failed to create request', err);
          }
        });
      }
    } else {
      this.markFormGroupTouched(this.serviceForm);
      console.warn('Form validation failed. Errors:', this.getFormValidationErrors());
    }
  }

  saveDraft(): void {
    const formValue = this.serviceForm.value;
    formValue.totalBudget = this.getTotalBudget();
    formValue.procurementType = 'SERVICE';
    formValue.status = 'DRAFT';

    if (formValue.items && Array.isArray(formValue.items)) {
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
      formValue.title = `Draft Service Request - ${new Date().toLocaleDateString()}`;
    }

    if (this.isEditMode && this.requestId) {
      this.procurementRequestService.updateRequest(parseIdToNumber(this.requestId), formValue).subscribe({
        next: () => { this.router.navigate(['/admin/sales/commerce/requests']); },
        error: (err) => {
          console.error('Failed to update request draft', err);
          this.router.navigate(['/admin/sales/commerce/requests']);
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
          this.router.navigate(['/admin/sales/commerce/requests']);
        }
      });
    }
  }

  getFormValidationErrors(): any {
    const errors: any = {};
    Object.keys(this.serviceForm.controls).forEach(key => {
      const control = this.serviceForm.get(key);
      if (control?.invalid) {
        if (control instanceof FormArray) {
          errors[key] = control.controls.map((c, idx) => {
            const itemErrors: any = {};
            if (c instanceof FormGroup) {
              Object.keys(c.controls).forEach(itemKey => {
                const itemControl = c.get(itemKey);
                if (itemControl?.invalid) {
                  itemErrors[itemKey] = itemControl.errors;
                }
              });
            }
            return itemErrors;
          });
        } else {
          errors[key] = control.errors;
        }
      }
    });
    return errors;
  }

  onBack(): void {
    this.router.navigate(['/admin/sales/commerce/requests/new']);
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
    const control = this.serviceForm.get(controlName);
    if (control && control.errors) {
      if (control.errors['required']) return 'This field is required';
      if (control.errors['minlength']) return `Minimum ${control.errors['minlength'].requiredLength} characters required`;
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
      if (control.errors['dateBefore']) return 'End date must be on or after start date';
    }
    return '';
  }

  formatCurrency(value: number): string {
    const currency = this.serviceForm.get('currency')?.value || 'NGN';
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
}
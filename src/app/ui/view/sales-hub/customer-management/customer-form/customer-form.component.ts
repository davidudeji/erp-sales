import { Component, OnInit, OnDestroy, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, FormArray, Validators } from '@angular/forms';
import { Router, RouterModule, ActivatedRoute } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { SalesService } from '../../../../service/sales/sales.service';
import { Customer } from '../../../../domain/sales/sales.dto';
import { formatApiDate } from '../../../../service/sales/date.util';
import { BackButtonComponent } from '../../../../shared-component/view/back-button/back-button.component';
import { Message, MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';

@Component({
  selector: 'app-customer-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, RouterModule, BackButtonComponent, ToastModule],
  templateUrl: './customer-form.component.html',
  styleUrls: ['./customer-form.component.scss']
})
export class CustomerFormComponent implements OnInit, OnDestroy {
  @Input() editId?: string | number;
  @Output() saved = new EventEmitter<void>();
  @Output() cancelled = new EventEmitter<void>();
 

  customerForm: FormGroup;
  isSubmitting = false;
  isLoading = false;
  isEditMode = false;
  customerId: string | number = '';

  // UI State
  showPasswordField = false;
  customerStats?: Customer;
  messages: Message[] = [];

  // Make router available to template
  router: Router;


  private destroy$ = new Subject<void>();

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private salesService: SalesService,
    private messageService: MessageService,
    router: Router
  ) {
    this.router = router;
    this.customerForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(100)]],
      email: ['', [Validators.required, Validators.email]],
      phone: ['', [Validators.required, Validators.pattern(/^[0-9+\-\s()]{7,20}$/)]],
      address: ['', [Validators.required, Validators.minLength(5), Validators.maxLength(255)]],
      taxId: ['', [Validators.maxLength(50)]],
      status: ['ACTIVE', Validators.required],
      notes: [''],
      bankAccounts: this.fb.array([])
    });
  }

  get bankAccounts(): FormArray {
    return this.customerForm.get('bankAccounts') as FormArray;
  }

  addBankAccount(): void {
    this.bankAccounts.push(this.fb.group({
      bankName: ['', Validators.required],
      accountName: ['', Validators.required],
      accountNumber: ['', [Validators.required, Validators.pattern(/^[0-9a-zA-Z\s\-]+$/)]],
      routingNumber: ['']
    }));
  }

  removeBankAccount(index: number): void {
    this.bankAccounts.removeAt(index);
  }



  ngOnInit(): void {

    this.customerId = this.editId || this.route.snapshot.paramMap.get('id') || '';
    const cleanId = String(this.customerId);
    this.isEditMode = !!cleanId;

    if (this.isEditMode) {
      this.loadCustomer();
    }
  }

  ngOnDestroy(): void {

    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadCustomer(): void {
    this.isLoading = true;
    this.salesService.getCustomerById(String(this.customerId)).subscribe({
      next: (customer: Customer | null) => {
        if (customer) {
          this.customerStats = customer;
          this.populateForm(customer);
        }
        this.isLoading = false;
      },
      error: (error: any) => {
        console.error('Error loading customer:', error);
        this.isLoading = false;
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to load customer. Please try again.' });
      }
    });
  }

  private populateForm(customer: Customer): void {
    // customer.address comes back from the API as a string[] (getCustomerById wraps it),
    // but the "address" control here is a plain text input backed by string-length
    // validators (minLength/maxLength). Patching the raw array in left the control's
    // *value* an array whose .length is the element count (usually 1), which always
    // failed minLength(5) even though the input displayed real text - silently blocking
    // every save with a spurious "Please fill in all required fields" warning.
    const addressValue = Array.isArray(customer.address) ? customer.address.join(', ') : (customer.address || '');
    this.customerForm.patchValue({
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
      address: addressValue,
      taxId: customer.taxId || '',
      status: customer.status,
      notes: customer.notes || ''
    });

    const accounts = this.bankAccounts;
    while (accounts.length) {
      accounts.removeAt(0);
    }
    if (customer.bankAccounts) {
      customer.bankAccounts.forEach(account => {
        accounts.push(this.fb.group({
          bankName: [account.bankName, Validators.required],
          accountName: [account.accountName, Validators.required],
          accountNumber: [account.accountNumber, [Validators.required, Validators.pattern(/^[0-9a-zA-Z\s\-]+$/)]],
          routingNumber: [account.routingNumber || '']
        }));
      });
    }
  }

  onSubmit(): void {
    if (this.customerForm.invalid) {
      this.customerForm.markAllAsTouched();
      this.messageService.add({ severity: 'warn', summary: 'Warning', detail: 'Please fill in all required fields' });
      return;
    }

    this.isSubmitting = true;

    const formValue = this.customerForm.value;
    const customerData: Partial<Customer> = {
      name: formValue.name,
      email: formValue.email,
      phone: formValue.phone,
      address: formValue.address,
      taxId: formValue.taxId || '',
      status: formValue.status,
      notes: formValue.notes || '',
      bankAccounts: formValue.bankAccounts || [],
      createdAt: this.isEditMode && this.customerStats ? this.customerStats.createdAt : new Date(),
      totalSpent: this.isEditMode && this.customerStats ? this.customerStats.totalSpent : 0,
      totalOrders: this.isEditMode && this.customerStats ? this.customerStats.totalOrders : 0
    };

    let request;
    if (this.isEditMode) {
      request = this.salesService.updateCustomer(String(this.customerId), customerData);
    } else {
      request = this.salesService.createCustomer(customerData);
    }

    request.subscribe({
      next: (response: Customer) => {
        this.isSubmitting = false;
        this.messageService.add({ severity: 'success', summary: 'Success', detail: this.isEditMode ? 'Customer updated successfully!' : 'Customer created successfully!' });
        let uuid = this.route.snapshot.paramMap.get('uuid');
        if (uuid === 'edit') {
          uuid = null;
        }
        // Land on the customer's own detail page either way — there's no bare 'customers'
        // list route registered (only 'customers/:id', 'customers/new', etc.), so navigating
        // to just ['/customers'] here used to match the app's catch-all single-segment
        // ':uuid' route and get redirected to /commerce/requests instead.
        const savedCustomerId = response?.id ?? this.customerId;
        const detailPath = uuid
          ? ['/customers', String(savedCustomerId), uuid]
          : ['/customers', String(savedCustomerId)];
        this.router.navigate(detailPath);
      },
      error: (error: any) => {
        console.error('Error saving customer:', error);
        this.isSubmitting = false;
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to save customer. Please try again.' });
      }
    });
  }

  cancel(): void {
    let uuid = this.route.snapshot.paramMap.get('uuid');
    if (uuid === 'edit') {
      uuid = null;
    }
    if (uuid) {
      this.router.navigate(['/sales-hub', uuid]);
    } else {
      this.router.navigate(['/sales-hub']);
    }
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(amount);
  }

  getStatusClass(status: string): string {
    const classes: Record<string, string> = {
      'ACTIVE': 'active',
      'INACTIVE': 'inactive',
      'BLACKLISTED': 'blacklisted'
    };
    return classes[status] || 'active';
  }

  formatDate(date?: Date | string): string {
    return formatApiDate(date, { year: 'numeric', month: 'short', day: 'numeric' }, 'en-NG', '');
  }

  isFieldInvalid(fieldName: string): boolean {
    const field = this.customerForm.get(fieldName);
    return field ? (field.invalid && (field.dirty || field.touched)) : false;
  }

  getFieldError(fieldName: string): string {
    const field = this.customerForm.get(fieldName);
    if (!field) return '';

    if (field.hasError('required')) {
      return 'This field is required';
    }
    if (field.hasError('email')) {
      return 'Please enter a valid email address';
    }
    if (field.hasError('minlength')) {
      const error = field.errors?.['minlength'];
      return `Minimum ${error.requiredLength} characters required`;
    }
    if (field.hasError('maxlength')) {
      const error = field.errors?.['maxlength'];
      return `Maximum ${error.requiredLength} characters allowed`;
    }
    if (field.hasError('pattern')) {
      return 'Please enter a valid phone number';
    }
    return '';
  }
}
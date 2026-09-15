// branch-form.component.ts
// ============================================================
// IMPORTS
// ============================================================

import { Component, OnInit, OnDestroy, Input, Output, EventEmitter } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { InventoryService } from '../../../../service/inventory/inventory.service';
import { Branch } from '../../../../domain/inventory/inventory.dto';

// ============================================================
// COMPONENT
// ============================================================

@Component({
  selector: 'app-branch-form',
  templateUrl: './branch-form.component.html',
  styleUrls: ['./branch-form.component.scss']
})
export class BranchFormComponent implements OnInit, OnDestroy {

  // ============================================================
  // INPUTS / OUTPUTS
  // ============================================================

  @Input() branchId: string = '';
  @Input() mode: 'create' | 'edit' = 'create';
  @Output() close = new EventEmitter<void>();
  @Output() saved = new EventEmitter<Branch>();

  // ============================================================
  // STATE
  // ============================================================

  branchForm: FormGroup;
  isLoading: boolean = false;
  isSaving: boolean = false;
  error: string | null = null;

  // Branch types (Standard/Flagship/Mini + any custom ones) — extensible via the "+ Add Branch
  // Type" option, same pattern as the RFQ form's "+ Add Category".
  branchTypes: string[] = [];
  showAddTypeModal: boolean = false;
  newBranchTypeName: string = '';

  // Private
  private destroy$ = new Subject<void>();

  // ============================================================
  // CONSTRUCTOR
  // ============================================================

  constructor(
    private fb: FormBuilder,
    private inventoryService: InventoryService,
    private router: Router,
    private route: ActivatedRoute
  ) {
    this.branchForm = this.buildForm();
  }

  // ============================================================
  // LIFECYCLE HOOKS
  // ============================================================

  ngOnInit(): void {
    this.loadBranchTypes();
    this.route.params.pipe(takeUntil(this.destroy$)).subscribe(params => {
      if (params['branchId'] && params['branchId'] !== 'new') {
        this.branchId = params['branchId'];
        this.mode = 'edit';
        this.loadBranchData();
      } else {
        this.mode = 'create';
      }
    });
  }

  private loadBranchTypes(): void {
    this.inventoryService.getBranchTypes()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (types) => { this.branchTypes = types; },
        error: (err) => console.error('Failed to load branch types:', err)
      });
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
      name: ['', [Validators.required, Validators.minLength(2)]],
      code: ['', [Validators.required, Validators.minLength(2)]],
      type: ['STANDARD', Validators.required],
      status: ['ACTIVE', Validators.required],
      contact: this.fb.group({
        manager: ['', Validators.required],
        phone: ['', Validators.required],
        email: ['', [Validators.email]]
      }),
      location: this.fb.group({
        address: ['', Validators.required],
        city: ['', Validators.required],
        state: ['', Validators.required],
        country: ['Nigeria', Validators.required],
        postalCode: [''],
        lat: [''],
        lng: ['']
      })
    });
  }

  // ============================================================
  // DATA LOADING
  // ============================================================

  loadBranchData(): void {
    if (!this.branchId) return;

    this.isLoading = true;
    this.error = null;

    this.inventoryService.getBranch(this.branchId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (branch) => {
          this.populateForm(branch);
          this.isLoading = false;
        },
        error: (err) => {
          console.error('Failed to load branch:', err);
          this.error = 'Failed to load branch details. Please try again.';
          this.isLoading = false;
        }
      });
  }

  private populateForm(branch: Branch): void {
    this.branchForm.patchValue({
      name: branch.name,
      code: branch.code,
      type: branch.type,
      status: branch.status,
      contact: {
        manager: branch.contact?.manager || '',
        phone: branch.contact?.phone || '',
        email: branch.contact?.email || ''
      },
      location: {
        address: branch.location?.address || '',
        city: branch.location?.city || '',
        state: branch.location?.state || '',
        country: branch.location?.country || 'Nigeria',
        postalCode: branch.location?.postalCode || '',
        lat: branch.location?.lat || '',
        lng: branch.location?.lng || ''
      }
    });
  }

  // ============================================================
  // SAVE
  // ============================================================

  save(): void {
    if (this.branchForm.invalid) {
      this.branchForm.markAllAsTouched();
      return;
    }

    this.isSaving = true;
    this.error = null;

    const formValue = this.branchForm.value;

    const branchData: any = {
      name: formValue.name,
      code: formValue.code,
      type: formValue.type,
      status: formValue.status,
      contact: {
        manager: formValue.contact.manager,
        phone: formValue.contact.phone,
        email: formValue.contact.email
      },
      location: {
        address: formValue.location.address,
        city: formValue.location.city,
        state: formValue.location.state,
        country: formValue.location.country,
        postalCode: formValue.location.postalCode || '',
        lat: formValue.location.lat || 0,
        lng: formValue.location.lng || 0
      }
    };

    if (this.mode === 'edit' && this.branchId) {
      this.inventoryService.updateBranch(this.branchId, branchData)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (branch) => {
            this.isSaving = false;
            this.saved.emit(branch);
            this.navigateToBranchDetail(String(branch.id));
          },
          error: (err) => {
            console.error('Failed to update branch:', err);
            this.error = 'Failed to update branch. Please try again.';
            this.isSaving = false;
          }
        });
    } else {
      this.inventoryService.createBranch(branchData)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (branch) => {
            this.isSaving = false;
            this.saved.emit(branch);
            this.navigateToBranchDetail(String(branch.id));
          },
          error: (err) => {
            console.error('Failed to create branch:', err);
            this.error = 'Failed to create branch. Please try again.';
            this.isSaving = false;
          }
        });
    }
  }

  // ============================================================
  // NAVIGATION
  // ============================================================

  /** Lands on the saved branch's own detail page so the change (or new branch) is visible
   *  immediately, instead of relying on browser history — location.back() has no page to return
   *  to (and lands on about:blank) whenever this form was opened as the first page in a tab, e.g.
   *  a bookmark, a direct link, or a fresh tab. */
  private navigateToBranchDetail(branchId: string): void {
    if (this.saved.observed) return;
    this.router.navigate(['/admin/sales/commerce/inventory/branches', branchId]);
  }

  goBack(): void {
    if (this.close.observed) {
      this.close.emit();
      return;
    }
    // Same about:blank risk as above — fall back to the branch list rather than trusting history.
    this.router.navigate(['/admin/sales/commerce/inventory']);
  }

  cancel(): void {
    this.goBack();
  }

  // ============================================================
  // BRANCH TYPE — "+ Add Branch Type"
  // ============================================================

  onBranchTypeChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    if (value === '__add_branch_type__') {
      this.branchForm.get('type')?.setValue('', { emitEvent: false });
      this.openAddTypeModal();
    }
  }

  openAddTypeModal(): void {
    this.newBranchTypeName = '';
    this.showAddTypeModal = true;
  }

  closeAddTypeModal(): void {
    this.showAddTypeModal = false;
  }

  saveCustomBranchType(): void {
    const name = this.newBranchTypeName.trim();
    if (!name) return;

    this.inventoryService.createBranchType(name)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (types) => {
          this.branchTypes = types;
          const matched = types.find(t => t.toLowerCase() === name.toLowerCase()) || name;
          this.branchForm.get('type')?.setValue(matched);
          this.closeAddTypeModal();
        },
        error: (err) => {
          console.error('Failed to add branch type:', err);
          this.error = 'Failed to add branch type. Please try again.';
        }
      });
  }

  // ============================================================
  // UI HELPERS (FIXED - These were missing and causing errors)
  // ============================================================

  isFieldInvalid(fieldName: string): boolean {
    const control = this.branchForm.get(fieldName);
    return !!control?.invalid && !!control?.touched;
  }

  isFieldValid(fieldName: string): boolean {
    const control = this.branchForm.get(fieldName);
    return !!control?.valid && !!control?.touched;
  }

  getFieldError(fieldName: string): string {
    const control = this.branchForm.get(fieldName);
    if (!control || !control.errors) return '';

    const errors = control.errors;
    if (errors['required']) return 'This field is required';
    if (errors['minlength']) {
      const required = errors['minlength'].requiredLength;
      return `Minimum ${required} characters required`;
    }
    if (errors['email']) return 'Please enter a valid email address';

    return 'Invalid input';
  }

  getInitials(name: string): string {
    if (!name) return '?';
    return name.charAt(0).toUpperCase();
  }

  formatDate(date: Date): string {
    if (!date) return '—';
    return new Date(date).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  }
}
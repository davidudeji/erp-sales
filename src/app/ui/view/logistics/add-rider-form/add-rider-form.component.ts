import { Component, EventEmitter, Output } from '@angular/core';
import { LogisticsService } from '../../../service/logistics/logistics.service';
import { Rider, RiderActiveStatus, RiderCreatePayload, VehicleType } from '../../../domain/logistics/logistics.dto';

@Component({
  selector: 'app-add-rider-form',
  templateUrl: './add-rider-form.component.html',
  styleUrl: './add-rider-form.component.scss'
})
export class AddRiderFormComponent {
  @Output() closed = new EventEmitter<void>();
  @Output() created = new EventEmitter<Rider>();

  readonly VehicleType = VehicleType;
  readonly RiderActiveStatus = RiderActiveStatus;

  form: RiderCreatePayload = {
    name: '',
    email: '',
    phone: '',
    vehicleType: VehicleType.BIKE,
    activeStatus: RiderActiveStatus.AVAILABLE
  };

  isSubmitting = false;
  errorMessage: string | null = null;

  constructor(private logisticsService: LogisticsService) {}

  get isValid(): boolean {
    return !!this.form.name.trim() && this.isValidEmail(this.form.email) && !!this.form.phone.trim();
  }

  private isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  }

  close(): void {
    this.closed.emit();
  }

  submit(): void {
    if (!this.isValid) {
      this.errorMessage = 'Please fill in a name, valid email, and phone number.';
      return;
    }
    this.errorMessage = null;
    this.isSubmitting = true;
    this.logisticsService.addRider(this.form).subscribe({
      next: (rider) => {
        this.isSubmitting = false;
        this.created.emit(rider);
      },
      error: () => {
        this.isSubmitting = false;
        this.errorMessage = 'Could not add rider — please try again.';
      }
    });
  }
}

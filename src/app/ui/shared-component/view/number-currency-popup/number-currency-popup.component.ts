import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatRadioModule } from '@angular/material/radio';
import { MatSelectModule } from '@angular/material/select';

@Component({
  selector: 'app-number-currency-popup',
  templateUrl: './number-currency-popup.component.html',
  styleUrl: './number-currency-popup.component.scss',
  imports: [
    CommonModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatRadioModule,
    MatSelectModule,
  ],
  standalone: true
})
export class NumberCurrencyPopupComponent {
  countries = [
    { value: 'us', viewValue: 'United States' },
    { value: 'in', viewValue: 'India' },
    { value: 'ng', viewValue: 'Nigeria' }
  ];

  constructor(public dialogRef: MatDialogRef<NumberCurrencyPopupComponent>) {}

  saveChanges(): void {
    // Save changes logic
    this.dialogRef.close();
  }
  // numberFormatCtrl!: FormControl;
  // decimalDigitsCtrl!: FormControl;

  // numberFormats = [
  //   { label: 'NGN 1,23,45,679 (India - English Lakhs)', value: 'IN_LAKHS' },
  //   { label: 'NGN 12,345,679 (United States - English Millions)', value: 'US_MILLIONS' },
  //   { label: '₦12,345,679 (Nigeria - English)', value: 'NG_NAIRA' }
  // ];

  // decimalDigits = [
  //   { label: 'Default', value: 'DEFAULT' },
  //   { label: '99', value: '99' },
  //   { label: '99.0', value: '99.0' },
  //   { label: '99.00', value: '99.00' },
  //   { label: '99.000', value: '99.000' },
  //   { label: '99.0000', value: '99.0000' }
  // ];

  // selectedNumberFormat = this.numberFormats[2].value;
  // selectedDecimalDigits = this.decimalDigits[0].value;
  // customCurrencySymbol = '';

  // onSubmit(form: any) {
  //   if (form.valid) {
  //     const selectedFormat = {
  //       numberFormat: this.selectedNumberFormat,
  //       decimalDigits: this.selectedDecimalDigits,
  //       customCurrencySymbol: this.customCurrencySymbol
  //     };

  //     console.log('Selected Format:', selectedFormat);
  //     alert('Settings saved successfully!');
  //   } else {
  //     console.log('Form is invalid');
  //   }
  // }
}

import { Component, Inject } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatRadioModule } from '@angular/material/radio';
import { FormsModule } from '@angular/forms';

export interface DiscountData {
  title: string;
  amount: number;
  type: 'PERCENTAGE' | 'FIXED';
}

@Component({
  selector: 'app-discount-popup',
  standalone: true,
  imports: [
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatRadioModule,
    FormsModule
  ],
  template: `
    <h2 mat-dialog-title>{{ data.title }}</h2>
    <mat-dialog-content>
      <mat-form-field appearance="fill" class="full-width">
        <mat-label>Amount</mat-label>
        <input matInput type="number" [(ngModel)]="data.amount" min="0" />
      </mat-form-field>
      <mat-radio-group [(ngModel)]="data.type">
        <mat-radio-button value="PERCENTAGE">Percentage</mat-radio-button>
        <mat-radio-button value="FIXED">Fixed Amount</mat-radio-button>
      </mat-radio-group>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="dialogRef.close()">Cancel</button>
      <button mat-button color="primary" (click)="dialogRef.close(data)">Save</button>
    </mat-dialog-actions>
  `,
  styleUrls: []
})
export class DiscountPopupComponent {
  constructor(
    public dialogRef: MatDialogRef<DiscountPopupComponent>,
    @Inject(MAT_DIALOG_DATA) public data: DiscountData
  ) {}
}

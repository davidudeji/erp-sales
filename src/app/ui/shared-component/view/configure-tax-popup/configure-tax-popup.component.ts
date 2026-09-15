import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { Observable } from 'rxjs';
import { DropdownService } from '../../service/dropdown/dropdown.service';


@Component({
  selector: 'app-configure-tax-popup',
  templateUrl: './configure-tax-popup.component.html',
  styleUrl: './configure-tax-popup.component.scss',
  imports: [CommonModule, MatDialogModule, MatButtonModule],
  standalone: true
})
export class ConfigureTaxPopupComponent {

  constructor(private dropdownService: DropdownService, public dialogRef: MatDialogRef<ConfigureTaxPopupComponent>){}


  taxList = [
    'TAX',
    'VAT'
   ]
   configureTax = this.taxList;

   isDropdownOpen$(id: string) {
    return this.dropdownService.isDropdownOpen$(id);
  }

  getSelectedItem$(id: string): Observable<string | null> {
    return this.dropdownService.getSelectedItem$(id);
  }

  toggleDropdown(id: string) {
    this.dropdownService.toggleDropdown(id);
  }

  selectItem(id: string, item: string) {
    this.dropdownService.selectItem(id, item);
  }

  saveChanges(): void {
    // Save changes logic
    this.dialogRef.close();
  }
}

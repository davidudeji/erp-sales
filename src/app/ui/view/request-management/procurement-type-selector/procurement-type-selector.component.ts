// procurement-type-selector.component.ts

import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { ProcurementType } from '../../../domain/procurement-request/procurement.dto';
import { v4 as uuidV4 } from 'uuid';
import { MessageService } from 'primeng/api';

@Component({
  selector: 'app-procurement-type-selector',
  templateUrl: './procurement-type-selector.component.html',
  styleUrls: ['./procurement-type-selector.component.scss']
})
export class ProcurementTypeSelectorComponent {

  typeForm: FormGroup;
  procurementTypes = [
    { value: 'PRODUCT' as ProcurementType, label: 'Products', icon: 'fas fa-boxes', description: 'Procure physical goods and items' },
    { value: 'SERVICE' as ProcurementType, label: 'Services', icon: 'fas fa-handshake', description: 'Procure professional services and expertise' }
  ];

  constructor(
    private messageService: MessageService,private fb: FormBuilder, private router: Router) {
    this.typeForm = this.fb.group({
      procurementType: ['', Validators.required]
    });
  }

  selectType(type: ProcurementType): void {
    if (type === 'SERVICE') {
      this.messageService.add({ severity: 'info', summary: 'Notice', detail: 'This feature is coming soon!' });
      return;
    }
    this.typeForm.patchValue({ procurementType: type });
  }

  proceed(): void {
    if (this.typeForm.valid) {
      const type = this.typeForm.get('procurementType')?.value;
      const uuid = uuidV4();
      if (type === 'PRODUCT') {
        this.router.navigate(['/admin/sales/commerce/requests/new/product', uuid]);
      } else if (type === 'SERVICE') {
        this.router.navigate(['/admin/sales/commerce/requests/new/service', uuid]);
      }
    }
  }
}
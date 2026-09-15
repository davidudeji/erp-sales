// product.module.ts
import { NgModule, NO_ERRORS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';

import { ProductDetailComponent } from './product-detail/product-detail.component';
import { ProductBulkImportComponent } from './product-bulk-import/product-bulk-import.component';
import { ProductManagementComponent } from './product-management/product-management.component';
import { ProductManagementDetailComponent } from './product-management-detail/product-management-detail.component';
import { ProductManagementFormComponent } from './product-management-form/product-management-form.component';

@NgModule({
  declarations: [
    ProductDetailComponent,
    ProductBulkImportComponent,
    ProductManagementDetailComponent
  ],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    ToastModule,
    ProductManagementComponent,
    ProductManagementFormComponent
  ],
  providers: [MessageService],
  schemas: [NO_ERRORS_SCHEMA]
})
export class ProductModule {}

import { NgModule, NO_ERRORS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ModalComponent } from './ui/shared-component/view/modal/modal.component';
import { SideModalComponent } from './ui/shared-component/view/side-modal/side-modal.component';

@NgModule({
  declarations: [
    ModalComponent,
    SideModalComponent
  ],
  imports: [
    CommonModule
  ],
  exports: [
    ModalComponent,
    SideModalComponent
  ],
  schemas: [NO_ERRORS_SCHEMA]
})
export class SharedOverlayModule { }

import { animate, state, style, transition, trigger } from '@angular/animations';
import { Component, EventEmitter, Output } from '@angular/core';

@Component({
  selector: 'app-large-side-modal',
  templateUrl: './large-side-modal.component.html',
  styleUrl: './large-side-modal.component.scss',
  standalone: true,
  animations: [
    trigger('openClose', [
      state('open', style({
        transform: 'translateX(0)', 
        opacity: 1
      })),
      state('closed', style({
        transform: 'translateX(100%)',
        opacity: 0.8
      })),
      transition('open => closed', [
        animate('0.5s ease-in-out')
      ]),
      transition('closed => open', [
        animate('0.5s ease-in-out')
      ]),
    ]),
  ],
})
export class LargeSideModalComponent {
  @Output() close = new EventEmitter<void>();

  closeModal() {
    this.close.emit();
  }

}

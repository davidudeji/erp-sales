import { Location } from '@angular/common';
import { Component, EventEmitter, Output } from '@angular/core';

@Component({
  selector: 'app-back-button',
  templateUrl: './back-button.component.html',
  styleUrl: './back-button.component.scss',
  standalone: true
})
export class BackButtonComponent {

  // @Output() backEvent = new EventEmitter<void>();

  constructor(private location: Location) {}

  @Output() close = new EventEmitter<void>();

  goBack() {
    if (window.history.length > 1) {
      this.location.back(); 
    } else {
      this.close.emit(); 
    }
  }
}

import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-button',
  templateUrl: './button.component.html',
  styleUrl: './button.component.scss',
  imports: [CommonModule],
  standalone: true
})
export class ButtonComponent {

  @Input() text: string = 'Button';
  @Input() type: 'button' | 'submit' | 'reset' = 'button';
  @Input() disabled: boolean = false; 
  @Input() class: string = '';

  @Output() btnClick = new EventEmitter<void>();

  onClick() {
    this.btnClick.emit();
  }

}

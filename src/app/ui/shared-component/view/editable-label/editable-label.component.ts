import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-editable-label',
  templateUrl: './editable-label.component.html',
  styleUrl: './editable-label.component.scss'
})
export class EditableLabelComponent {
  @Input() text?: string;
  @Output() textChange = new EventEmitter<string>();
  
  isEditing = false;

  edit() {
    this.isEditing = true;
  }

  save(event: any) {
    this.isEditing = false;
    this.text = event.target.value;
    this.textChange.emit(this.text);
  }
}

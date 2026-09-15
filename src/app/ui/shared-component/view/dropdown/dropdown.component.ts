import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-dropdown',
  templateUrl: './dropdown.component.html',
  styleUrl: './dropdown.component.scss'
})
export class DropdownComponent {
  @Input() options: { id: string, name: string }[] = [];
  @Input() selectedValue: string | null = null;
  @Output() valueChange = new EventEmitter<string>();

  toggleDropdownOpen = false;

  toggleDropdown() {
    this.toggleDropdownOpen = !this.toggleDropdownOpen;
  }

  selectOption(option: { id: string, name: string }) {
    this.selectedValue = option.id;
    this.valueChange.emit(option.id);
    this.toggleDropdownOpen = false;
  }

  getSelectedOptionName(): string {
    const selectedOption = this.options.find(o => o.id === this.selectedValue);
    return selectedOption ? selectedOption.name : 'Select Option';
  }
}

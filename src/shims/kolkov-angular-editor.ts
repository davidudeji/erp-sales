import { CommonModule } from '@angular/common';
import { Component, EventEmitter, forwardRef, Input, NgModule, Output } from '@angular/core';
import { ControlValueAccessor, FormsModule, NG_VALUE_ACCESSOR } from '@angular/forms';

export interface AngularEditorConfig {
  editable?: boolean;
  spellcheck?: boolean;
  height?: string;
  minHeight?: string;
  maxHeight?: string;
  placeholder?: string;
  translate?: string;
  defaultParagraphSeparator?: string;
  defaultFontName?: string;
  toolbarHiddenButtons?: string[][];
  [key: string]: unknown;
}

@Component({
  selector: 'angular-editor',
  standalone: true,
  imports: [CommonModule, FormsModule],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => AngularEditorComponent),
      multi: true,
    },
  ],
  template: `
    <div class="editor-shell" [style.height]="config?.height || null" [style.max-height]="config?.maxHeight || null">
      <textarea
        class="editor-input"
        [disabled]="disabled || config?.editable === false"
        [placeholder]="resolvedPlaceholder"
        [spellcheck]="config?.spellcheck ?? true"
        [style.min-height]="config?.minHeight || config?.height || '160px'"
        [style.height]="config?.height || '160px'"
        [style.max-height]="config?.maxHeight || null"
        [value]="value"
        (input)="handleInput($event)"
        (blur)="handleBlur()"
      ></textarea>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      width: 100%;
    }

    .editor-shell {
      width: 100%;
    }

    .editor-input {
      width: 100%;
      padding: 0.75rem 0.875rem;
      border: 1px solid #d0d7de;
      border-radius: 0.5rem;
      background: #fff;
      color: inherit;
      font: inherit;
      line-height: 1.5;
      resize: vertical;
      box-sizing: border-box;
    }

    .editor-input:focus {
      outline: 2px solid rgba(59, 130, 246, 0.2);
      border-color: #3b82f6;
    }

    .editor-input:disabled {
      background: #f3f4f6;
      cursor: not-allowed;
    }
  `],
})
export class AngularEditorComponent implements ControlValueAccessor {
  @Input() config?: AngularEditorConfig;
  @Input() placeholder = '';
  @Output() blur = new EventEmitter<void>();

  value = '';
  disabled = false;

  private onChange: (value: string) => void = () => {};
  private onTouched: () => void = () => {};

  get resolvedPlaceholder(): string {
    return this.placeholder || (this.config?.placeholder as string) || '';
  }

  writeValue(value: string | null): void {
    this.value = value ?? '';
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }

  handleInput(event: Event): void {
    const target = event.target as HTMLTextAreaElement;
    this.value = target.value;
    this.onChange(this.value);
  }

  handleBlur(): void {
    this.onTouched();
    this.blur.emit();
  }
}

@NgModule({
  imports: [AngularEditorComponent],
  exports: [AngularEditorComponent],
})
export class AngularEditorModule {}

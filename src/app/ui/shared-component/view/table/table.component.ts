import { Component, ContentChild, EventEmitter, Input, Output } from '@angular/core';
import { TableBodyDirective } from './table-body.directive';

export interface TableColumn<T = any> {
  header: string;
  field?: keyof T | string;
  sortable?: boolean;
  sortField?: string;
  formatter?: (row: T) => string | number;
  badgeClass?: (row: T) => string;
  className?: string;
  align?: 'left' | 'center' | 'right';
}

export interface TableAction<T = any> {
  id: string;
  label: string;
  icon?: string;
  className?: string;
  visible?: (row: T) => boolean;
  disabled?: (row: T) => boolean;
}

@Component({
  selector: 'app-table',
  templateUrl: './table.component.html',
  styleUrl: './table.component.scss'
})
export class TableComponent {
  @Input() columns: TableColumn[] = [];
  @Input() rows: any[] = [];
  @Input() actions: TableAction[] = [];
  @Input() emptyMessage: string = 'No records found.';
  @Input() wrapperClass: string = '';
  @Input() tableClass: string = '';
  @Input() tableStyle: Record<string, any> | null = null;
  @Input() compact: boolean = false;
  @Input() striped: boolean = false;
  @Input() rowClickable: boolean = false;
  @Input() selectable: boolean = false;
  @Input() selectionMode: 'single' | 'multiple' = 'multiple';
  @Input() selection: any[] | any = [];
  @Input() dataKey?: string;
  @Input() paginator: boolean = false;
  @Input() rowsPerPage: number = 10;
  @Input() rowsPerPageOptions: number[] = [10, 20, 50];

  @Output() rowClick = new EventEmitter<any>();
  @Output() actionClick = new EventEmitter<{ actionId: string; row: any }>();
  @Output() selectionChange = new EventEmitter<any[] | any>();

  @ContentChild(TableBodyDirective) bodyTemplate?: TableBodyDirective;

  get colSpan(): number {
    const actionCount = this.actions?.length ? 1 : 0;
    const selectionCount = this.selectable ? 1 : 0;
    return this.columns.length + actionCount + selectionCount || 1;
  }

  buildClass(base: string, extra: string): string {
    return [base, extra].filter(Boolean).join(' ');
  }

  resolveCell(row: any, column: TableColumn): string | number {
    if (column.formatter) {
      return column.formatter(row);
    }

    if (!column.field) return '';
    const value = this.getFieldValue(row, column.field as string);
    return value ?? '—';
  }

  getFieldValue(row: any, field: string): any {
    if (!row || !field) return '';
    if (!field.includes('.')) return row[field];
    return field.split('.').reduce((acc, key) => (acc ? acc[key] : undefined), row);
  }

  handleRowClick(row: any) {
    if (!this.rowClick.observed) return;
    this.rowClick.emit(row);
  }

  handleActionClick(actionId: string, row: any, event: MouseEvent) {
    event.stopPropagation();
    this.actionClick.emit({ actionId, row });
  }

  handleSelectionChange(selection: any[] | any) {
    this.selection = selection;
    this.selectionChange.emit(selection);
  }

  getSortField(column: TableColumn): string | undefined {
    if (!column.sortable) return undefined;
    return (column.sortField || column.field) as string | undefined;
  }
}

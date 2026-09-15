// dropdown.service.ts
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class DropdownService {
  private dropdownState = new BehaviorSubject<{ [id: string]: boolean }>({});
  private selectedItems = new BehaviorSubject<{ [id: string]: string | null }>({});

  isDropdownOpen$(id: string): Observable<boolean> {
    return this.dropdownState.asObservable().pipe(
      map(state => state[id] || false)
    );
  }

  getSelectedItem$(id: string): Observable<string | null> {
    return this.selectedItems.asObservable().pipe(
      map(items => items[id] || null)
    );
  }

  toggleDropdown(id: string) {
    const currentState = this.dropdownState.value;
    this.dropdownState.next({ ...currentState, [id]: !currentState[id] });
  }

  selectItem(id: string, item: string) {
    const currentItems = this.selectedItems.value;
    this.selectedItems.next({ ...currentItems, [id]: item });
  }
}

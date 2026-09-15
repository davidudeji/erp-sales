// currency.service.ts
import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class CurrencyService {
  private selectedCurrencySubject = new BehaviorSubject<string>('Select Currency');
  selectedCurrency$ = this.selectedCurrencySubject.asObservable();

  selectCurrency(currency: string) {
    this.selectedCurrencySubject.next(currency);
  }
}
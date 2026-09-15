import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class RandomTokenService {

  constructor() { }

 public getRandomToken(): string {
    return Math.random().toString(36).substr(2, 50);
  }

}

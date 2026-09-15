import { Component } from '@angular/core';

@Component({
  selector: 'app-profile-info',
  templateUrl: './profile-info.component.html',
  styleUrls: ['./profile-info.component.scss'],
  standalone: true
})
export class ProfileInfoComponent {
  progress: number = 58; // Default progress value
  clipPath: string = '';

  constructor() { }

  ngOnInit(): void {
    this.setProgress(this.progress);
  }

  setProgress(percent: number): void {
    const radius = percent * 0.01 * 50;
    this.clipPath = `circle(${radius}% at center)`;
  }
}

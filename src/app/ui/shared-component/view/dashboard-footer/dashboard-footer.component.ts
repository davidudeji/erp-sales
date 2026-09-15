import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';

@Component({
  selector: 'app-dashboard-footer',
  templateUrl: './dashboard-footer.component.html',
  styleUrl: './dashboard-footer.component.scss',
})
export class DashboardFooterComponent {
  currentYear?: number;
  ngOnInit(): void {
    this.currentYear = new Date().getFullYear();
  }
}

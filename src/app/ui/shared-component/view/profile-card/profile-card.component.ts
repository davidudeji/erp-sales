import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-profile-card',
  templateUrl: './profile-card.component.html',
  styleUrls: ['./profile-card.component.scss'],
  imports: [CommonModule],
  standalone: true
})
export class ProfileCardComponent {
  @Input() profiles: { img: string, name: string, position: string }[] = [];
}

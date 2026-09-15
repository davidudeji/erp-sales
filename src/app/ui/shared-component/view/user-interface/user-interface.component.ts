import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { ProfileCardComponent } from '../profile-card/profile-card.component';

@Component({
  selector: 'app-user-interface',
  templateUrl: './user-interface.component.html',
  styleUrls: ['./user-interface.component.scss'],
  imports: [CommonModule, ProfileCardComponent],
  standalone: true
})
export class UserInterfaceComponent {
  titles = ['Front End', 'Back End'];

  profiles = [
    {
      img: 'assets/profile-pic.avif',
      name: 'Aribisala Abiola',
      position: 'Front End Developer',
    },
    {
      img: 'assets/profile.jpg',
      name: 'Gbujie Chidi',
      position: 'Back End Developer',
    },
    {
      img: 'assets/profile.jpg',
      name: 'Adah Charles',
      position: 'Back End Developer',
    },
    {
      img: 'assets/profile-pic.avif',
      name: 'Olatunbosun Simeon',
      position: 'Front End Developer',
    },
    {
      img: 'assets/profile-pic.avif',
      name: 'Olatunbosun Simeon',
      position: 'Front End Developer',
    },
    {
      img: 'assets/profile-pic.avif',
      name: 'Olatunbosun Simeon',
      position: 'Front End Developer',
    },
    {
      img: 'assets/profile-pic.avif',
      name: 'Olatunbosun Simeon',
      position: 'Front End Developer',
    },
    {
      img: 'assets/profile-pic.avif',
      name: 'Olatunbosun Simeon',
      position: 'Front End Developer',
    },
  ];

  frontEndProfiles = this.profiles.filter(
    (profile) => profile.position === 'Front End Developer'
  );
  backEndProfiles = this.profiles.filter(
    (profile) => profile.position === 'Back End Developer'
  );
}

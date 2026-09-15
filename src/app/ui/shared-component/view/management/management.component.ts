import { Component } from '@angular/core';

@Component({
  selector: 'app-management',
  templateUrl: './management.component.html',
  styleUrls: ['./management.component.scss']
})
export class ManagementComponent {
  titles = ['Management Lead', 'Project Manager'];

  profiles = [
    { img: 'assets/profile-pic.avif', name: 'Engr Damilola Awe', position: 'Project Manager' },
    { img: 'assets/profile.jpg', name: 'AB', position: 'Management Lead' },
    { img: 'assets/profile.jpg', name: 'AB', position: 'Project Manager' },
    { img: 'assets/profile.jpg', name: 'AB', position: 'Project Manager' },
    { img: 'assets/profile.jpg', name: 'AB', position: 'Management Lead' },
    { img: 'assets/profile.jpg', name: 'AB', position: 'Project Manager' },
  ];



  managementLeadProfiles = this.profiles.filter(profile => profile.position === 'Management Lead');
  projectManagerProfiles = this.profiles.filter(profile => profile.position === 'Project Manager');
}

import { Component } from '@angular/core';

@Component({
  selector: 'app-product-design',
  templateUrl: './product-design.component.html',
  styleUrls: ['./product-design.component.scss']
})
export class ProductDesignComponent {
  profiles = [
    { img: 'assets/profile-pic.avif', name: 'Ena', position: 'UI/UX Designer' },
    { img: 'assets/profile-pic.avif', name: 'Riman', position: 'UI/UX Designer' },
    { img: 'assets/profile-pic.avif', name: 'Sope', position: 'UI/UX Designer' },
  ];
}

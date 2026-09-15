import { Component } from '@angular/core';
import { NavigationLinksService } from '../../service/navigation-links/navigation-links.service';

@Component({
  selector: 'app-sidebar',
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.scss'],
  standalone: false
})
export class SidebarComponent {
  activeItem: string | null = null;
  dropdownOpen: string | null = null;
  sidebarHidden: boolean = false;


  constructor(
    public navigationLink: NavigationLinksService,
  ) {}

  
  ngOnInit(): void {
    this.activeItem = 'dashboard';
  }

  setActive(item: string) {
    this.activeItem = item;
  }



  toggleDropdown(item: string) {
    if (this.dropdownOpen === item) {
        this.dropdownOpen = null;
    } else {
        this.dropdownOpen = item;
    }
  }



}

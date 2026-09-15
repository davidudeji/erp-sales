import { Injectable } from '@angular/core';
import { MenuItem } from '../../domain/menuItem.dto';
import { NavigationLinksService } from '../../service/navigation-links/navigation-links.service';
// import { NavigationLinksService } from '../navigation-links/navigation-links.service';

@Injectable({
  providedIn: 'root'
})
export class MenuItemsService {

  public menuItems: MenuItem[] = [];
  public settingsMenuItems: MenuItem[] = [];

  constructor(
    private navigationLink: NavigationLinksService
  ){
    this.initializeSettingsMenuItems();
  }

  
    private initializeSettingsMenuItems(): void {
    this.settingsMenuItems = [
      {
        label: 'General Settings',
        route: this.navigationLink.getLink('generalSettings'),
        roles: ['ROLE_USER', 'ROLE_ADMIN'],
        icon: 'pi pi-home',
        submenu: [
          { label: 'Profile', route: this.navigationLink.getLink('purchaseLink'), roles: ['ROLE_USER', 'ROLE_ADMIN'], icon: 'pi pi-file' },
          { label: 'Security', route: this.navigationLink.getLink('purchaseLink'), roles: ['ROLE_USER', 'ROLE_ADMIN'], icon: 'pi pi-file' },
        ],
      },
      {
        label: 'Sales',
        roles: ['ROLE_USER', 'ROLE_ADMIN'],
        route: this.navigationLink.getLink('salesSettings'),
        icon: 'pi pi-dollar', 
        submenu: [
          { label: 'Profile', route: this.navigationLink.getLink('purchaseLink'), roles: ['ROLE_USER', 'ROLE_ADMIN'], icon: 'pi pi-file' },
          { label: 'Security', route: this.navigationLink.getLink('purchaseLink'), roles: ['ROLE_USER', 'ROLE_ADMIN'], icon: 'pi pi-file' },
        ],
      },
      {
        label: 'Purchase',
        route: this.navigationLink.getLink('purchaseSettings'),
        roles: ['ROLE_USER', 'ROLE_ADMIN'],
        icon: 'pi pi-shopping-cart', 
        submenu: [
          { label: 'Profile', route: this.navigationLink.getLink('purchaseLink'), roles: ['ROLE_USER', 'ROLE_ADMIN'], icon: 'pi pi-file' },
          { label: 'Security', route: this.navigationLink.getLink('purchaseLink'), roles: ['ROLE_USER', 'ROLE_ADMIN'], icon: 'pi pi-file' },
        ],
      },
      {
        label: 'Inventory',
        roles: ['ROLE_USER' , 'ROLE_ADMIN'],
        route: this.navigationLink.getLink('inventorySettings'),
  
        icon: 'pi pi-cog',
        submenu: [
          { label: 'User Management', route: this.navigationLink.getLink('inventoryLink'), roles: ['ROLE_USER'], icon: 'pi pi-users' },
        ],
      },
      {
        label: 'Procurement',
        roles: ['ROLE_USER', 'ROLE_ADMIN'],
        route: this.navigationLink.getLink('vendorSettings'),
  
        icon: 'pi pi-truck', 
        submenu: [
          { label: 'Request For Quotation', route: this.navigationLink.getLink('rfqLink'), roles: ['ROLE_USER'], icon: 'pi pi-file' },
          { label: 'Settings', route: this.navigationLink.getLink('procurementSettingsLink'), roles: ['ROLE_USER'], icon: 'pi pi-cog' },
        ],
      },
      {
        label: 'Accounting',
        roles: ['ROLE_USER', 'ROLE_ADMIN'],
        route: this.navigationLink.getLink('accountSettings'),
  
        icon: 'pi pi-credit-card', 
        submenu: [
          { label: 'Quotation', route: this.navigationLink.getLink('accountingLink'), roles: ['ROLE_USER'], icon: 'pi pi-file' },
          // { label: 'Invoice', route: "", roles: ['ROLE_USER'], icon: 'pi pi-file' },
        ],
      },
      {
        label: 'Human Resources',
        roles: ['ROLE_USER', 'ROLE_ADMIN'],
        route: this.navigationLink.getLink('HRSettings'),
  
        icon: 'pi pi-users', 
        submenu: [
          { label: 'Recruitment', route: this.navigationLink.getLink('recuitmentLink'), roles: ['ROLE_USER'], icon: 'pi pi-user' },
          { label: 'Interview', route: this.navigationLink.getLink('interviewLink'), roles: ['ROLE_USER'], icon: 'pi pi-check' },
          { label: 'Attendance', route: this.navigationLink.getLink('attendanceLink'), roles: ['ROLE_USER'], icon: 'pi pi-check' },
          { label: 'Leave', route: this.navigationLink.getLink('leaveLink'), roles: ['ROLE_USER'], icon: 'pi pi-user' },
          { label: 'Score Sheet', route: this.navigationLink.getLink('leaveLink'), roles: ['ROLE_USER'], icon: 'pi pi-user' },
  
        ],
      },
      {
        label: 'POS',
        roles: ['ROLE_USER', 'ROLE_ADMIN'],
        route: this.navigationLink.getLink('posSettings'),
  
        icon: 'pi pi-shopping-bag', 
        submenu: [
          { label: 'Sales', route: this.navigationLink.getLink('posLink'), roles: ['ROLE_USER'], icon: 'pi pi-cart' },
         
        ],
      },
      {
        label: 'Checkout',
        route: this.navigationLink.getLink('checkoutSettings'),
        roles: ['ROLE_USER', 'ROLE_ADMIN'],
        icon: 'pi pi-check', 
        submenu: [
          { label: 'Order Summary', route: this.navigationLink.getLink('checkoutLink'), roles: ['ROLE_USER'], icon: 'pi pi-file' },
   
        ],
      },
      {
        label: 'CRM',
        route: this.navigationLink.getLink('CRMSettings'),
        roles: ['ROLE_USER', 'ROLE_ADMIN'],
        icon: 'pi pi-users', 
        submenu: [
          { label: 'Contacts', route: this.navigationLink.getLink('crmLink'), roles: ['ROLE_USER'], icon: 'pi pi-user' },
         
        ],
      },
      {
        label: 'Expense',
        roles: ['ROLE_USER', 'ROLE_ADMIN'],
        route: this.navigationLink.getLink('expenseSettings'),
  
        icon: 'pi pi-money-bill', 
        submenu: [
          { label: 'Expenses', route: this.navigationLink.getLink('expensesLink'), roles: ['ROLE_USER'], icon: 'pi pi-dollar' },
   
  
        ],
      },
      {
        label: 'Tender',
        route: this.navigationLink.getLink('tenderSettings'),
  
        roles: ['ROLE_USER', 'ROLE_ADMIN'],
        icon: 'pi pi-user' 
      },
      {
        label: 'Vendor',
        roles: ['ROLE_USER', 'ROLE_ADMIN'],
        icon: 'pi pi-money-bill',
        route: this.navigationLink.getLink('vendorSettings'),
        submenu: [
          { label: 'View 1', route: this.navigationLink.getLink('vendorLink'), roles: ['ROLE_USER'], icon: 'pi pi-dollar' },
          { label: 'Incoming RFQ ', route: this.navigationLink.getLink('vendorRfqLink'), roles: ['ROLE_USER'], icon: 'pi pi-credit-card' },
        ],
      },
      {
        label: 'User Management',
        route: this.navigationLink.getLink('userManagmentSettings'),
        roles: ['ROLE_USER', 'ROLE_ADMIN'],
        icon: 'pi pi-cog' 
      },
    ]
  }
  






  getSettingsMenuItemsForRole(role: string): MenuItem[] {
    return this.settingsMenuItems.filter(item => item.roles.includes(role));
  }
}

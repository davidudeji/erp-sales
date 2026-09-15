export interface MenuItem {
    label: string;
    route?: string;
    component?: any;
    icon?: string;
    roles: string[];
    submenu?: MenuItem[];
    open?: boolean; 
  }
  
import { Type } from "@angular/core";

export interface Data {
}

export interface InventoryItem {
  id: string;
  itemName: string;
  partNo: string;
  taxRate: number;
  description: string;
  images: string[];
  buyingPrice: number;
  sellingPrice: number;
  initialStock: number;
  totalSoldQuantity: number;
  totalPurchaseQuantity: number;
}


export interface Gender {
  gender: string;
}


export interface City {
  name: string;
  cities: string[];
  state: string;
  country: string;
}

export interface TabConfig {
  name: string;
  component: any;
  icon?: string;
  hasDropdown?: boolean;
  dropdownOptions?: DropdownOption[]; 
  role?: string
  data?: any;
}

export interface DropdownOption {
  label: string; 
  action: string; 
  component: Type<any>;
}

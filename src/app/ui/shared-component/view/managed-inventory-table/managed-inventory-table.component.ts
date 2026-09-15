import { Component, OnInit, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { InventoryService } from 'src/app/ui/inventory/service/inventory/inventory.service';


@Component({
  selector: 'app-managed-inventory-table',
  templateUrl: './managed-inventory-table.component.html',
  styleUrl: './managed-inventory-table.component.scss'
})
export class ManagedInventoryTableComponent {

  inventory: any[] = [];
  

  constructor(
    private router: Router,
    private inventoryService: InventoryService
  ) {}

  ngOnInit() {
    this.inventoryService.getItem().subscribe(data => {
      this.inventory = data;
    });
  }

}

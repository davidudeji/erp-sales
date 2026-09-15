import { Component } from '@angular/core';
import { TopProductService } from 'src/app/ui/dashboard/service/top-product/top-product.service';

@Component({
  selector: 'app-account-payabale-management',
  templateUrl: './account-payabale-management.component.html',
  styleUrl: './account-payabale-management.component.scss',
  providers: [TopProductService],
})
export class AccountPayabaleManagementComponent {
  tableData: any[];

  constructor(private topProductsService: TopProductService) {
    this.tableData = [];
  }

  ngOnInit(): void {
    this.tableData = this.topProductsService.initializeTopProduct();
  }
}

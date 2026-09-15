import { Component } from '@angular/core';
import { TopProductService } from 'src/app/ui/dashboard/service/top-product/top-product.service';

@Component({
  selector: 'app-cash-management',
  templateUrl: './cash-management.component.html',
  styleUrl: './cash-management.component.scss',
  providers: [TopProductService],
})
export class CashManagementComponent {
  tableData: any[];

  constructor(private topProductsService: TopProductService) {
    this.tableData = [];
  }

  ngOnInit(): void {
    this.tableData = this.topProductsService.initializeTopProduct();
  }
}

import { Component } from '@angular/core';
import { TopProductService } from 'src/app/ui/dashboard/service/top-product/top-product.service';

@Component({
  selector: 'app-general-ledeger-management',
  templateUrl: './general-ledeger-management.component.html',
  styleUrl: './general-ledeger-management.component.scss',
  providers: [
    TopProductService
  ]
})
export class GeneralLedegerManagementComponent {
  tableData: any[];


  constructor(private topProductsService: TopProductService) {
    this.tableData = [];
   }

  ngOnInit(): void {
    this.tableData = this.topProductsService.initializeTopProduct();
  }
}

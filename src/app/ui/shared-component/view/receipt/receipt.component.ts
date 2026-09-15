import { Component } from '@angular/core';
import { TopProductService } from 'src/app/ui/dashboard/service/top-product/top-product.service';


@Component({
  selector: 'app-receipt',
  templateUrl: './receipt.component.html',
  styleUrl: './receipt.component.scss',
  providers: [
    TopProductService
  ]
})
export class ReceiptComponent {
  tableData: any[];


  constructor(private topProductsService: TopProductService) {
    this.tableData = [];
   }

  ngOnInit(): void {
    this.tableData = this.topProductsService.initializeTopProduct();
  }

}

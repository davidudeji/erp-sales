import { Component, Input, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { InventoryItem } from '../../service/interface/data';
// import { InventoryService } from 'src/app/ui/inventory/service/inventory/inventory.service';

@Component({
  selector: 'app-view-product-aside',
  templateUrl: './view-product-aside.component.html',
  styleUrl: './view-product-aside.component.scss'
})
export class ViewProductAsideComponent implements OnInit {

  // items: any[] = [];
  item: InventoryItem | undefined;


  constructor(
    private route: ActivatedRoute,
    // private inventoryService: InventoryService,
    private router: Router
  ) { }

  ngOnInit(): void {

    this.item = history.state.item;

    // Access the state passed through the router
    // this.inventoryService.getItem().subscribe(data => {
    //   this.items = data;
    // });

    // Alternatively, if the browser history state is not reliable:
    // const navigation = this.router.getCurrentNavigation();
    // this.item = navigation?.extras.state?.item;
  }

  
}

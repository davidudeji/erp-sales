import { Component, Output, EventEmitter } from '@angular/core';
import { Router } from '@angular/router';
import { AuthenticationService } from '../../service/auth-service/authentication.service';

@Component({
  selector: 'app-navbar2',
  templateUrl: './navbar2.component.html',
  styleUrls: ['./navbar2.component.scss', './navbar.component.scss']
})
export class Navbar2Component {

  // constructor(
  //   public navbar: NavbarComponent,
  // ){

  // }

  @Output() toggleSidebar = new EventEmitter<void>();

  userInfoRegData: any[] = [];
  userRegData: any = {};
  

  constructor(
    private router: Router,
    private authenticationService: AuthenticationService,

  ){}

  onToggleSidebar() {
    this.toggleSidebar.emit();
  }


  ngOnInit() {
    if (sessionStorage.getItem("username") == null) {
        console.log(
            "Session Expired.",
            "Your current session has expired. Re-login."
        );
        this.router.navigate([""]);
    }

    this.userInfoRegData = JSON.parse(sessionStorage["userRegData"]);
    this.userRegData = this.userInfoRegData;

    console.log("testing client types", this.userInfoRegData);
}
  




  logout(): void {
    this.authenticationService.logout();

    // sessionStorage.removeItem("username");
    // sessionStorage.removeItem("token");

    // //added by yomi
    // sessionStorage.removeItem("userInfoRegData");
    // sessionStorage.removeItem("userRegData");
    // sessionStorage.removeItem("accessToken");
    // sessionStorage.removeItem("userid");
    // sessionStorage.removeItem("Token");

    // this.router.navigate([''])
}




}

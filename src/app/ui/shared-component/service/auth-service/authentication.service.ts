import { Injectable, isDevMode } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { catchError, Observable, throwError } from 'rxjs';
import { Router } from '@angular/router';
import { JwtHelperService } from '@auth0/angular-jwt';
import { NavigationLinksService } from '../navigation-links/navigation-links.service';
import { environment } from '../environments/environment.prod';



@Injectable({
  providedIn: 'root'
})
export class AuthenticationService {
  private _apiBaseUrl = (environment as any).apiBaseUrl;

  constructor(
    private http: HttpClient, 
    private navigationLink: NavigationLinksService, 
    private router: Router,
    private jwtHelper: JwtHelperService
  ) {  }

  isAuthenticated(): boolean {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');

    if (!token || this.jwtHelper.isTokenExpired(token)) {
      return false;
    }

    return true;
  }
  
  logout(): void {
    sessionStorage.removeItem("username");
    sessionStorage.removeItem("token");

    //added by yomi
    sessionStorage.removeItem("userInfoRegData");
    sessionStorage.removeItem("userRegData");
    sessionStorage.removeItem("accessToken");
    sessionStorage.removeItem("userid");
    sessionStorage.removeItem("Token");
    sessionStorage.removeItem("userPrimaryInfoRegData");


    // this.router.navigate([''])
    const loginLink = this.navigationLink.getLink('signinLink')
    this.router.navigate([loginLink]);
  }

  isLoggedIn(): boolean {
    return !!sessionStorage.getItem('userid');
  }


  userLogin(data: any): Observable<any> {
    // console.log((this.getBaseApiUrl() + "/x/api/v2/auth/sigin"+"---"+JSON.stringify(data)))

    return this.http
        .post<any>(this.getBaseApiUrl() + "/x/api/v2/auth/signin", data)
        .pipe(catchError(this.handleError));
  }

  getUserPrimaryInfoById(data: string): Observable<any>{
    // console.log((this.getBaseApiUrl() + `/x/api/v2/us/ur/get/user/primary/info/${data}`+"---"+JSON.stringify(data)))
    // const url = `${this.getBaseApiUrl()}/x/api/v2/us/ur/get/user/primary/info/${data}`;

    return this.http
        .get<any>(
            this.getBaseApiUrl() +
                `/x/api/v2/us/ur/get/user/primary/info/${data}`)
        .pipe(catchError(this.handleError));
  }

  getUserBranchInfoById(id: string): Observable<any>{
    return this.http
        .get<any>(
            this.getBaseApiUrl() + `/x/api/v2/pos/userBranches/findBy/userid/${id}`)
        .pipe(catchError(this.handleError));
  }

  getRegDataByUsername(username: string): Observable<any> {
    // console.log((this.getBaseApiUrl() + "/x/api/v2/us/ur/findByUsernameOrEmail?username="+"---"+JSON.stringify(username)))

    return this.http
        .get<any>(
            this.getBaseApiUrl() +
                "/x/api/v2/us/ur/findByUsernameOrEmail?username=" +
                username
        )
        .pipe(catchError(this.handleError));
  }

  
  userRegistration(data: any): Observable<any> {
    // console.log((this.getBaseApiUrl() + "/x/api/v2/auth/signup"+"---"+JSON.stringify(data)))

    return this.http
      .post<any>(this.getBaseApiUrl() + "/x/api/v2/auth/signup", data)
      .pipe(catchError(this.handleError));
  }

  userRegistrationByAdmin(data: any): Observable<any> {
    // console.log((this.getBaseApiUrl() + "/x/api/v2/auth/signup"+"---"+JSON.stringify(data)))

    return this.http
      .post<any>(this.getBaseApiUrl() + "/x/api/v2/us/ur/signup/by/admin", data)
      .pipe(catchError(this.handleError));
  }

  userApplicationRole(data: any): Observable<any> {
    return this.http
      .post<any>(this.getBaseApiUrl() + `/x/api/v2/us/ur/appuserrolepermission`, data)
      .pipe(catchError(this.handleError));
  }

  userVerification(token: string): Observable<any> {
    // console.log((this.getBaseApiUrl() + "/x/api/v2/us/register/verify?token="+"---"+JSON.stringify(token)))

    return this.http
      .get<any>(this.getBaseApiUrl() + '/x/api/v2/us/register/verify?token=' + token)
      .pipe(catchError(this.handleError))
  }

  getUserApplicationRole(id: number): Observable<any> {

return this.http
  .get<any>(this.getBaseApiUrl() + `/x/api/v2/us/ur/findappuserrolepermissionbyid?userid=${id}`)
  .pipe(catchError(this.handleError));
  
  }

  private getBaseApiUrl(): string {
    return isDevMode() ? environment.apiBaseUrl : environment.apiBaseUrl;
  }
  
  private handleError(error: HttpErrorResponse) {
    if (error.error instanceof ErrorEvent) {
        console.error("An error occurred:", error.error.message);
    } else {
        console.error(
            `Backend returned code ${error.status}, ` +
                `body was: ${JSON.stringify(error.error)}`
        );
    }
    return throwError(`${error.status}`);
    // 'Something bad happened; please try again later.');
  }
}

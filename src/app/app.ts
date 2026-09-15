import { Component, signal } from '@angular/core';
import { BehaviorSubject, Observable, firstValueFrom } from 'rxjs';
import { AuthenticationService } from './ui/shared-component/service/auth-service/authentication.service';
import { MessageService } from 'primeng/api';

@Component({
  selector: 'app-root',
  templateUrl: './app.html',
  standalone: false,
  styleUrl: './app.scss'
})
export class App {
  protected readonly title = signal('erp-sales');

  showCloseRegisterModal = false;
  openingAmount: number = 0;
  closingAmount: number | null = null;
  finalizedRegisterData: any = null;
  private _isOffline = new BehaviorSubject<boolean>(!navigator.onLine);
  isOffline$: Observable<boolean> = this._isOffline.asObservable();

  constructor(
    private authenticationService: AuthenticationService,
    private messageService: MessageService,
  ) {
    this.userLoginAction();
    window.addEventListener('online', () => this._isOffline.next(false));
    window.addEventListener('offline', () => this._isOffline.next(true));
    
    // Override window.alert to display PrimeNG toast messages instead
    window.alert = (message: any) => {
      const msgStr = message ? String(message) : '';
      const isError = msgStr.toLowerCase().includes('fail') || 
                      msgStr.toLowerCase().includes('error') || 
                      msgStr.toLowerCase().includes('could not') ||
                      msgStr.toLowerCase().includes('required') ||
                      msgStr.toLowerCase().includes('please');
      
      this.messageService.add({
        severity: isError ? 'error' : 'success',
        summary: isError ? 'Error' : 'Success',
        detail: msgStr,
        life: 5000
      });
    };
  }

  ngOnInit(): void {
   this.userLoginAction();
    // this.metadataService.fetchMetaData(true);

 
  }



  async userLoginAction(): Promise<void> {
    console.log("Signing in user with hardcoded credentials for testing...");
    const loginDetails = {
      username: 'Eseose',
      password: 'soyBTY86b*rC',
      project: 'ERP',
      clientId: 'optimax-erp-web',
      appVersion: '2026.05.30',
    };

    try {
      const data = await this.authenticationService
        .userLogin(loginDetails)
        .toPromise();
      this.loadInitParam(data);

      console.log(data)

      if (data) {
        this.authenticationService.getUserPrimaryInfoById(data.id).subscribe(
          (data: { industry: number; }) => {
            console.log(data);
          },
          (error: any) => {
            console.error('Error fetching user info:', error);
          }
        );
      }
    } catch (error) {
      console.log(error);
    }
  }

  loadInitParam(data: any) {
    sessionStorage.setItem('role', data.roles);
    sessionStorage.setItem('username', data.username);
    sessionStorage.setItem('fullname', data.fullname || data.fullName || data.name || data.username);
    sessionStorage.setItem('email', data.email);
    sessionStorage.setItem('userid', data.id);
    
    const token = this.extractToken(data.accessToken);

    if (!token) {
      throw new Error('Unable to extract access token from login response');
    }

    sessionStorage.setItem('Token', token);
    sessionStorage.setItem('token', token);
    localStorage.setItem('Token', token);
    localStorage.setItem('token', token);
    localStorage.setItem('Token2', token);
    sessionStorage.setItem('accessToken', data.accessToken);
    localStorage.setItem('accessToken2', data.accessToken);
    sessionStorage.setItem('userRegData', JSON.stringify(data));

    this.getUserBranchInfo(data);
  }

  private extractToken(accessToken: unknown): string {
    const rawToken = String(accessToken || '').trim();

    if (!rawToken) {
      return '';
    }

    const cookieMatch = rawToken.match(/=(.*?)(;|$)/);
    if (cookieMatch?.[1]) {
      return cookieMatch[1].trim();
    }

    const bearerMatch = rawToken.match(/^Bearer\s+(.+)$/i);
    if (bearerMatch?.[1]) {
      return bearerMatch[1].trim();
    }

    return rawToken;
  }


  getUserBranchInfo(data: any) {
    const userId = sessionStorage.getItem('userid');
      if (!userId) {
        return;
      }

    this.authenticationService.getUserBranchInfoById(userId).subscribe(
      (      data: any) => {
        sessionStorage["userBranchInfoRegData"] = JSON.stringify(data);
      },
      (      error: any) => {
        console.error('Error fetching user branch info:', error);
      }
    );
  }

  onFinalizeRegister(data: any) {
    // Save finalized register data to localStorage
    localStorage.setItem('registerFinalized', 'true');
    localStorage.setItem('registerFinalizedData', JSON.stringify(data));
    localStorage.setItem('registerState', 'false');
    localStorage.setItem('closingAmount', String(data.closeAmount));
    this.finalizedRegisterData = data;
    this.showCloseRegisterModal = false;
  }

  onCloseRegisterModal() {
    this.showCloseRegisterModal = false;
  }
}

Here is the architectural breakdown of this codebase from the perspective of a Principal Software Architect.

1. ARCHITECTURAL OVERVIEW
Primary Architectural Paradigm
This codebase is an Enterprise Angular 18 Application structured around a Multi-Layered Modular Architecture with Tab-Shell Composition and Reactive State Facades.

┌─────────────────────────────────────────────────────────────────────────────────┐
│                      Micro-Frontend / Host Application                          │
│                         Mounted at /admin/sales                                 │
└────────────────────────────────────────┬────────────────────────────────────────┘
                                         │
┌────────────────────────────────────────▼────────────────────────────────────────┐
│                              AppDevModule / AppModule                           │
│     (Multi-tenant HTTP Interceptors, Global Toast alerts, Session Hydration)    │
└───────┬─────────────────────────────────────────────────────────────────┬───────┘
        │                                                                 │
┌───────▼───────────────────────────┐         ┌───────────────────────────▼───────┐
│       Top-Level Tab Shells        │         │        Deep-Linked Routes         │
│   (SalesHub, VendorPortal, etc.)  │         │   (Forms, Wizards, Details)       │
└───────┬───────────────────────────┘         └───────────────────────────┬───────┘
        │ Dynamic *ngComponentOutlet                                     │
┌───────▼─────────────────────────────────────────────────────────────────▼───────┐
│                     Feature Views & Shared UI Primitives                        │
│             (TableComponent, NavTabComponent, StatusBadges, etc.)              │
└───────────────────────────────────────┬─────────────────────────────────────────┘
                                        │ RxJS Subscriptions & Snapshot Getters
┌───────────────────────────────────────▼─────────────────────────────────────────┐
│                   Domain Service Facades (State & Business Rules)               │
│     (VendorService, BehaviorSubjects, pure calculative domain engines)          │
└───────────────────────────────────────┬─────────────────────────────────────────┘
                                        │
┌───────────────────────────────────────▼─────────────────────────────────────────┐
│                   HTTP Layer & Multi-Tenant Interceptors                        │
│          (AuthInterceptor: X-Tenant-ID + Bearer token → REST API)               │
└─────────────────────────────────────────────────────────────────────────────────┘
High-Level Mental Model
When building in this codebase, adopt these 4 mental models:

Sub-Tree Shared Core: The directory 

src/app/ui/shared-component
 is managed as a Git Subtree (pullShared / pushShared scripts in 

package.json
). Core design tokens, base HTTP interceptors, shared interfaces, and common widgets (TableComponent, NavTabComponent) live here.
Tab-Shell Composition Pattern: Top-level sections (e.g., 

SalesHubComponent
, 

VendorPortalComponent
, 

InventoryComponent
) are Tab Shells. Instead of loading child pages purely via <router-outlet>, they declare a tabsConfig: TabConfig[] array and delegate rendering to 

NavTabComponent
 which dynamically instantiates components via *ngComponentOutlet.
Reactive In-Memory State with Snapshot Bridges: Services (e.g. 

VendorService
) keep state in private BehaviorSubject instances exposed as read-only observables (rfqs$, quotations$). Mutating actions update the subject immediately. Synchronous snapshot getters (getRfqsSnapshot()) allow cross-domain bridges (like 

rfq-quotation-bridge.util.ts
) to communicate across feature modules without cyclic dependencies.
Multi-Tenant Context Propagation: The application is multi-tenant by convention. Tenant IDs are derived from the browser hostname (parts[0] or default 'optimax'), and injected into outgoing HTTP requests alongside JWT tokens.
2. THE BOOTSTRAP & LIFE CYCLE
Here is the exact step-by-step execution path when the application initializes:

[index.html]
    │  Renders <app-root>, links CSS (FontAwesome, styles.scss)
    ▼
[src/main.ts]
    │  Defines devRoutes = [{ path: 'admin/sales', children: routes }]
    │  Calls platformBrowser().bootstrapModule(AppDevModule, { ngZoneEventCoalescing: true })
    ▼
[AppDevModule -> AppModule (src/app/app.module.ts)]
    │  Registers Core Modules (BrowserModule, BrowserAnimationsModule, RouterModule)
    │  Registers Providers (AuthInterceptor, ErrorToastInterceptor, MessageService)
    ▼
[Root Component: App (src/app/app.ts)]
    │  constructor():
    │    ├── Overrides window.alert to route messages into PrimeNG Toast notifications
    │    ├── Listens to 'online' / 'offline' events for offline detection
    │    └── Invokes userLoginAction()
    ▼
[AuthenticationService.userLogin()]
    │  Executes POST with credentials, stores 'Token', 'role', 'username', 'userid' in sessionStorage
    ▼
[app.html]
    │  Mounts <p-toast></p-toast>
    │  Mounts <router-outlet></router-outlet>
    ▼
[AppRoutingModule (src/app/app-routing-module.ts)]
    │  Resolves route (e.g., path: "" redirects to 'sales-hub')
    ▼
[Target Component: SalesHubComponent / VendorPortalComponent]
    │  Initializes tabsConfig
    │  Passes tabsConfig to <app-nav-tab>
    │  NavTabComponent resolves active tab from sessionStorage cache or defaults to tab[0]
    │  Renders active view via *ngComponentOutlet="tab.component"
Host HTML Load: 

src/index.html
 provides <app-root></app-root> and global stylesheet assets.
Browser Platform Bootstrap: 

src/main.ts
 calls platformBrowser().bootstrapModule(AppDevModule, { ngZoneEventCoalescing: true }). AppDevModule prefixes routes under admin/sales so the module can run standalone during development while matching its parent ERP shell route layout in production.
Module Compilation & DI: 

AppModule
 registers DI providers:
HTTP_INTERCEPTORS: 

AuthInterceptor
 and 

ErrorToastInterceptor
.
PrimeNG services: MessageService, ConfirmationService.
Root Component Instantiation: 

App
 initializes:
Monkey-patches window.alert so any legacy alert call renders as a modern PrimeNG Toast.
Binds browser network status listeners (_isOffline).
Invokes userLoginAction(), which seeds sessionStorage (Token, role, userid, tenant).
Template & Route Resolution: 

src/app/app.html
 activates <router-outlet>. The router maps the URL against 

src/app/app-routing-module.ts
, which defaults to sales-hub or vendor-portal.
3. CORE REUSABLE PRIMITIVES
These are the core abstractions you will interact with constantly:

1. NavTabComponent (

nav-tab.component.ts
)
Role: Primary UI layout orchestrator for multi-view workspaces.
Mechanism: Takes an array of 

TabConfig
:
typescript
export interface TabConfig {
  name: string;
  component: Type<any>;
  icon?: string;
  role?: string;
  hasDropdown?: boolean;
  dropdownOptions?: DropdownOption[];
}
It caches the selected tab in sessionStorage using cacheKey and switches child views using <ng-container *ngComponentOutlet="tab.component">.
2. TableComponent (

table.component.ts
)
Role: The standard design-system data table.
Mechanism: Wraps sorting, pagination, selection, and row actions. It accepts typed TableColumn<T>[]:
typescript
export interface TableColumn<T = any> {
  header: string;
  field?: keyof T | string;
  sortable?: boolean;
  formatter?: (row: T) => string | number;
  badgeClass?: (row: T) => string;
  align?: 'left' | 'center' | 'right';
}
Components customize column layouts either via the column definition or by providing a custom row body template via 

TableBodyDirective
.
3. Domain Service Facade (e.g. VendorService in 

vendor.service.ts
)
Role: Single source of truth for business logic and in-memory module state.
Mechanism:
Exposes private BehaviorSubject streams (rfqs$$) as public Observable streams (rfqs$).
Implements pure calculation functions exported outside the class (computeQuotationTotals(), isQuotationSubmittable(), lineTotal()) so pricing logic is shared consistently between live UI components and backend persistence routines.
Exposes synchronous snapshot methods (getRfqsSnapshot()) for cross-service bridges.
4. AuthInterceptor (

auth.interceptor.service.ts
)
Role: Transparent HTTP security and multi-tenancy enforcement.
Mechanism: Intercepts every HttpClient request, derives the tenant identifier (X-Tenant-ID), and injects Authorization: Bearer <token> retrieved from sessionStorage.getItem("Token").
4. DATA FLOW & STATE
Data travels from the UI down to the core logic and backend following this flow:

[ 1. User Interaction ]
   │ Click "Save / Submit Quotation" in DashboardComponent
   ▼
[ 2. Component Validation & Calculation ]
   │ Uses shared pure functions:
   │ computeQuotationTotals(quotation) & isQuotationSubmittable(quotation)
   ▼
[ 3. Domain Service Facade (VendorService) ]
   │ Calls this.vendorService.submitQuotation(quotationPayload)
   │ ├── Optimistic State Update:
   │ │     this.quotations$$.next(updatedList)
   │ └── Trigger Backend Call:
   │       this.http.post<Quotation>(`${this.baseUrl}/quotations`, payload)
   ▼
[ 4. Angular HTTP Interceptor Chain ]
   │ ├── AuthInterceptor:
   │ │     - Clones request
   │ │     - Injects header 'X-Tenant-ID': tenantId
   │ │     - Injects header 'Authorization': `Bearer ${accessToken}`
   │ └── ErrorToastInterceptor:
   │       - Catches HttpErrorResponse
   │       - Dispatches error to MessageService (PrimeNG Toast)
   ▼
[ 5. Remote REST API ]
   │ https://be.optimaxsuites.com/x/api/v2/commerce/...
   ▼
[ 6. Response & State Hydration ]
   │ On success: Service maps response, updates BehaviorSubject.
   │ Active Components subscribed via `pipe(takeUntil(this.destroy$))` update automatically.
5. "HELLO WORLD" MAP
If you want to create a new feature—for example, an "Activity Log" feature within the Vendor Portal—here are the exact files to create and wire up:

Step 1: Create the Domain DTO
Create 

src/app/ui/domain/vendor-portal/activity-log.dto.ts
:

typescript
export interface ActivityLog {
  id: string;
  action: string;
  performedBy: string;
  timestamp: string;
  details: string;
}
Step 2: Create the Domain Service
Create 

src/app/ui/service/vendor-portal/activity-log.service.ts
:

typescript
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { ActivityLog } from '../../domain/vendor-portal/activity-log.dto';
import { environment } from '../../shared-component/service/environments/environment';
@Injectable({ providedIn: 'root' })
export class ActivityLogService {
  private readonly baseUrl = `${environment.apiBaseUrl}/x/api/v2/commerce/activity-logs`;
  private logs$$ = new BehaviorSubject<ActivityLog[]>([]);
  readonly logs$: Observable<ActivityLog[]> = this.logs$$.asObservable();
  constructor(private http: HttpClient) {}
  loadLogs(): void {
    this.http.get<ActivityLog[]>(this.baseUrl).subscribe({
      next: (logs) => this.logs$$.next(logs),
      error: () => {
        // Mock fallback for local testing
        this.logs$$.next([
          { id: '1', action: 'Quotation Created', performedBy: 'Vendor Admin', timestamp: new Date().toISOString(), details: 'QT-2026-001 created' }
        ]);
      }
    });
  }
}
Step 3: Create the Feature Component
Create 

src/app/ui/view/vendor-portal/activity-log/activity-log.component.ts
:

typescript
import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { ActivityLogService } from '../../../service/vendor-portal/activity-log.service';
import { ActivityLog } from '../../../domain/vendor-portal/activity-log.dto';
import { TableColumn } from '../../../shared-component/view/table/table.component';
@Component({
  selector: 'app-activity-log',
  template: `
    <div class="p-4 bg-white rounded-lg shadow-sm">
      <h2 class="text-base font-semibold mb-4 text-slate-800">Activity Logs</h2>
      <app-table [columns]="columns" [rows]="logs" [paginator]="true" [rowsPerPage]="10"></app-table>
    </div>
  `,
  standalone: false
})
export class ActivityLogComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  logs: ActivityLog[] = [];
  columns: TableColumn[] = [
    { header: 'Action', field: 'action', sortable: true },
    { header: 'Performed By', field: 'performedBy', sortable: true },
    { header: 'Date', field: 'timestamp', formatter: (r) => new Date(r.timestamp).toLocaleString() },
    { header: 'Details', field: 'details' }
  ];
  constructor(private logService: ActivityLogService) {}
  ngOnInit(): void {
    this.logService.loadLogs();
    this.logService.logs$.pipe(takeUntil(this.destroy$)).subscribe((l) => (this.logs = l));
  }
  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
Step 4: Register in AppModule
Open 

src/app/app.module.ts
:

Import ActivityLogComponent.
Add ActivityLogComponent to the declarations array (notice angular.json configures standalone: false by default).
Step 5: Wire into Existing Code
To display it in the Vendor Portal workspace, edit 

src/app/ui/view/vendor-portal/vendor-portal.component.ts
:

typescript
import { ActivityLogComponent } from './activity-log/activity-log.component';
export class VendorPortalComponent {
  tabsConfig: TabConfig[] = [
    // ...existing tabs
    {
      name: 'Activity Log',
      component: ActivityLogComponent,
      icon: 'fa-solid fa-clock-rotate-left',
    }
  ];
}
Because 

vendor-portal.component.html
 contains <app-nav-tab [tabsConfig]="tabsConfig">, the new tab will automatically appear in the navigation bar, cache its tab state, and render <app-activity-log> when clicked.

11:39 AM

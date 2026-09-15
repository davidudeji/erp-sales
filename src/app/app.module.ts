import { NgModule, NO_ERRORS_SCHEMA } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { provideAnimations } from '@angular/platform-browser/animations';
import { AppRoutingModule } from './app-routing-module';
import { App } from './app';
import { DialogModule } from '@angular/cdk/dialog';
import { CommonModule, DecimalPipe } from '@angular/common';
import { ProductModule } from './ui/view/inventory/product/product.module';
import { MatDialogModule } from '@angular/material/dialog';
import { RouterModule } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { MatTabsModule } from '@angular/material/tabs';
import { MatDividerModule } from '@angular/material/divider';
import { MatRadioModule } from '@angular/material/radio';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatTableModule } from '@angular/material/table';
import { NgSelectComponent, NgSelectModule } from '@ng-select/ng-select';
import { MatRippleModule } from '@angular/material/core';
import { CalendarModule } from 'primeng/calendar';
import { MultiSelectModule } from 'primeng/multiselect';
import { AngularEditorModule } from '@kolkov/angular-editor';

////primeng
import { ButtonModule } from 'primeng/button';
import { EditorModule } from 'primeng/editor';
import { PasswordModule } from 'primeng/password';
import { TableModule } from 'primeng/table';
import { ToastModule } from 'primeng/toast';
import { SidebarModule } from 'primeng/sidebar';
import { TabViewModule } from 'primeng/tabview';
import { ToolbarModule } from 'primeng/toolbar';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { SplitButtonModule } from 'primeng/splitbutton';
import { PanelModule } from 'primeng/panel';
import { DividerModule } from 'primeng/divider';
import { OverlayPanelModule } from 'primeng/overlaypanel';
import { StepperModule } from 'primeng/stepper';
import { InputTextModule } from 'primeng/inputtext';
import { FloatLabelModule } from 'primeng/floatlabel';
import { MessagesModule } from 'primeng/messages';
import { MessageModule } from 'primeng/message';
import { ConfirmationService, MessageService } from 'primeng/api';
import { RippleModule } from 'primeng/ripple';
import { DropdownModule } from 'primeng/dropdown';
import { TagModule } from 'primeng/tag';
import { RadioButtonModule } from 'primeng/radiobutton';
import { ButtonComponent } from './ui/shared-component/view/button/button.component';
import { ProfileCardComponent } from './ui/shared-component/view/profile-card/profile-card.component';
import { ProfileInfoComponent } from './ui/shared-component/view/profile-info/profile-info.component';
import { UserInterfaceComponent } from './ui/shared-component/view/user-interface/user-interface.component';
import { BackButtonComponent } from './ui/shared-component/view/back-button/back-button.component';
import { VpStatusBadgeComponent } from './ui/view/vendor-portal/shared/status-badge/status-badge.component';
import { CommandPaletteComponent } from './ui/view/vendor-portal/shared/command-palette/command-palette.component';
import { TableComponent } from './ui/shared-component/view/table/table.component';
import { TableBodyDirective } from './ui/shared-component/view/table/table-body.directive';
import { SidebarComponent } from './ui/shared-component/view/sidebar/sidebar.component';
import { SharedOverlayModule } from './shared-overlay.module';
import { FormsModule } from '@angular/forms';

import { ReactiveFormsModule } from '@angular/forms';
import { HTTP_INTERCEPTORS, provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';

import { JwtHelperService, JWT_OPTIONS } from '@auth0/angular-jwt';
import { AuthInterceptor } from './ui/shared-component/service/auth-service/auth.interceptor.service';
import { ErrorToastInterceptor } from './ui/shared-component/service/error-message/error-toast.interceptor';

import { NavTabComponent } from './ui/shared-component/view/nav-tab/nav-tab.component';

import { RequestManagementComponent } from './ui/view/request-management/request-management.component';
import { RequestForQuotationListComponent } from './ui/view/request-management/request-for-quotation-list/request-for-quotation-list.component';
import { RequestForQuotationDraftsComponent } from './ui/view/request-management/request-for-quotation-drafts/request-for-quotation-drafts.component';
import { RequestForQuotationFormComponent } from './ui/view/request-management/request-for-quotation-form/request-for-quotation-form.component';
import { RequestForQuotationServiceFormComponent } from './ui/view/request-management/request-for-quotation-service-form/request-for-quotation-service-form.component';
import { ProcurementTypeSelectorComponent } from './ui/view/request-management/procurement-type-selector/procurement-type-selector.component';
import { RfqTemplateSelectorComponent } from './ui/view/request-management/rfq-template-selector/rfq-template-selector.component';
import { VendorSelectionComponent } from './ui/view/request-management/vendor-selection/vendor-selection.component';
import { SmartVendorSelectionComponent } from './ui/view/request-management/smart-vendor-selection/smart-vendor-selection.component';
import { DeliveryTrackingComponent } from './ui/view/request-management/delivery-tracking/delivery-tracking.component';
import { PaymentVoucherComponent } from './ui/view/request-management/payment-voucher/payment-voucher.component';
import { GrnListComponent } from './ui/view/request-management/grn-list/grn-list.component';
import { GrnDetailComponent } from './ui/view/request-management/grn-detail/grn-detail.component';
import { NotificationPanelComponent } from './ui/view/request-management/notification-panel/notification-panel.component';
import { ReceiptPreviewComponent } from './ui/view/request-management/receipt-preview/receipt-preview.component';
import { RequestForQuotationDetailComponent } from './ui/view/request-management/request-for-quotation-detail/request-for-quotation-detail.component';
import { RfqDetailWithQuotationsComponent } from './ui/view/request-management/rfq-detail-with-quotations/rfq-detail-with-quotations.component';
import { QuotationsDashboardComponent } from './ui/view/request-management/quotations-dashboard/quotations-dashboard.component';
import { QuotationDetailComponent } from './ui/view/request-management/quotation-detail/quotation-detail.component';
import { LpoPreviewComponent } from './ui/view/request-management/lpo-preview/lpo-preview.component';
import { RfqPreviewComponent } from './ui/view/request-management/rfq-preview/rfq-preview.component';
import { ApprovalInboxComponent } from './ui/view/request-management/approval-inbox/approval-inbox.component';
import { ApprovalRfqDetailComponent } from './ui/view/request-management/approval-rfq-detail/approval-rfq-detail.component';
import { InvoicesComponent } from './ui/view/request-management/invoices/invoices.component';

import { DocumentationHistoryComponent } from './ui/view/request-management/documentation-history/documentation-history.component';
import { ProcurementMessagingComponent } from './ui/view/request-management/procurement-messaging/procurement-messaging.component';

import { DashboardComponent } from './ui/view/vendor-portal/dashboard/dashboard.component';
import { FinanceComponent } from './ui/view/vendor-portal/finance/finance.component';
import { PipelineComponent } from './ui/view/vendor-portal/pipeline/pipeline.component';
import { LpoComponent } from './ui/view/vendor-portal/lpo/lpo.component';
import { VendorPortalComponent } from './ui/view/vendor-portal/vendor-portal.component';
import { SalesDashboardComponent } from './ui/view/sales-hub/sales-dashboard/sales-dashboard.component';
import { ProductServiceCatalogListComponent } from './ui/view/sales-hub/product-service-catalog/product-service-catalog-list/product-service-catalog-list.component';
import { DeliveryManagementComponent } from './ui/view/sales-hub/delivery-management/delivery-management.component';
import { PaymentProcessingComponent } from './ui/view/sales-hub/payment-processing/payment-processing.component';
import { SalesAndTransactionsListComponent } from './ui/view/sales-hub/sales-and-transactions/sales-and-transactions-list/sales-and-transactions-list.component';
import { SalesAndTransactionsDetailComponent } from './ui/view/sales-hub/sales-and-transactions/sales-and-transactions-detail/sales-and-transactions-detail.component';
import { SalesHubComponent } from './ui/view/sales-hub/sales-hub.component';
import { QuoteFormComponent } from './ui/view/sales-hub/quotations/quote-form/quote-form.component';
import { QuoteDetailComponent } from './ui/view/sales-hub/quotations/quote-detail/quote-detail.component';
import { PerformanceComponent } from './ui/view/vendor-portal/performance/performance.component';
import { DocumentsComponent } from './ui/view/vendor-portal/documents/documents.component';
import { InvoiceFormComponent } from './ui/view/sales-hub/invoices/invoice-form/invoice-form.component';
import { InvoiceListComponent } from './ui/view/sales-hub/invoices/invoice-list/invoice-list.component';
import { InvoiceDetailComponent } from './ui/view/sales-hub/invoices/invoice-detail/invoice-detail.component';
import { CustomerListComponent } from './ui/view/sales-hub/customer-management/customer-list/customer-list.component';
import { CustomerFormComponent } from './ui/view/sales-hub/customer-management/customer-form/customer-form.component';

import { VendorRegistrationComponent } from './ui/view/vendor-portal/vendor-registration/vendor-registration.component';
import { TemplateTypesComponent } from './ui/view/sales-hub/template-types/template-types.component';
import { VendorDashboardComponent } from './ui/view/vendor-portal/vendor-dashboard/vendor-dashboard.component';
import { NgApexchartsModule } from 'ng-apexcharts';
import { VendorProfileComponent } from './ui/view/vendor-portal/vendor-profile/vendor-profile.component';

import { VendorManagementComponent } from './ui/view/vendor-management/vendor-management.component';
import { VendorManagementDashboardComponent } from './ui/view/vendor-management/vendor-management-dashboard/vendor-management-dashboard.component';
import { VendorManagementListComponent } from './ui/view/vendor-management/vendor-management-list/vendor-management-list.component';
import { VendorManagementDetailComponent } from './ui/view/vendor-management/vendor-management-detail/vendor-management-detail.component';
import { VendorApprovalQueueComponent } from './ui/view/vendor-management/vendor-approval-queue/vendor-approval-queue.component';

import { OverviewComponent } from './ui/view/vendor-management/vendor-management-detail/overview/overview.component';
import { VendorPerformanceComponent } from './ui/view/vendor-management/vendor-management-detail/performance/performance.component';
import { RiskComponent } from './ui/view/vendor-management/vendor-management-detail/risk/risk.component';
import { VendorDocumentsComponent } from './ui/view/vendor-management/vendor-management-detail/documents/documents.component';
import { ActivityComponent } from './ui/view/vendor-management/vendor-management-detail/activity/activity.component';

import { InventoryComponent } from './ui/view/inventory/inventory.component';
import { InventoryDashboardComponent } from './ui/view/inventory/inventory-dashboard/inventory-dashboard.component';
import { ProductManagementComponent } from './ui/view/inventory/product/product-management/product-management.component';
import { BranchInventoryComponent } from './ui/view/inventory/branch/branch-inventory/branch-inventory.component';
import { BranchDetailComponent } from './ui/view/inventory/branch/branch-detail/branch-detail.component';
import { BranchInventoryTableComponent } from './ui/view/inventory/branch/branch-inventory-table/branch-inventory-table.component';
import { BranchTransferHistoryComponent } from './ui/view/inventory/branch/branch-transfer-history/branch-transfer-history.component';
import { BranchInventoryFormComponent } from './ui/view/inventory/branch/branch-inventory-form/branch-inventory-form.component';
import { BranchFormComponent } from './ui/view/inventory/branch/branch-form/branch-form.component';
import { StockMovementComponent } from './ui/view/inventory/stock/stock-movement/stock-movement.component';
import { StockMovementFormComponent } from './ui/view/inventory/stock/stock-movement-form/stock-movement-form.component';
import { TransferWizardComponent } from './ui/view/inventory/stock/transfer-wizard/transfer-wizard.component';
import { BulkTransferComponent } from './ui/view/inventory/stock/bulk-transfer/bulk-transfer.component';
import { StockMovementDetailComponent } from './ui/view/inventory/stock/stock-movement-detail/stock-movement-detail.component';
import { MovementApprovalComponent } from './ui/view/inventory/stock/movement-approval/movement-approval.component';
import { RestockManagementComponent } from './ui/view/inventory/restock/restock-management/restock-management.component';
import { RestockRequestFormComponent } from './ui/view/inventory/restock/restock-request-form/restock-request-form.component';
import { RestockSuggestionComponent } from './ui/view/inventory/restock/restock-suggestion/restock-suggestion.component';
import { RestockRequestListComponent } from './ui/view/inventory/restock/restock-request-list/restock-request-list.component';
import { RestockSuggestionsPageComponent } from './ui/view/inventory/restock/restock-suggestions-page/restock-suggestions-page.component';
import { ThresholdManagementComponent } from './ui/view/inventory/restock/threshold-management/threshold-management.component';
import { RestockApprovalComponent } from './ui/view/inventory/restock/restock-approval/restock-approval.component';
import { BranchManagerDashboardComponent } from './ui/view/inventory/branch-managers/branch-manager-dashboard/branch-manager-dashboard.component';
import { AnalyticsComponent } from './ui/view/inventory/inventory-analytics/analytics/analytics.component';
import { ProductAnalyticsComponent } from './ui/view/inventory/inventory-analytics/product-analytics/product-analytics.component';
import { BranchAnalyticsComponent } from './ui/view/inventory/inventory-analytics/branch-analytics/branch-analytics.component';
import { AffordabilityDashboardComponent } from './ui/view/inventory/inventory-analytics/affordability-dashboard/affordability-dashboard.component';
import { StockTurnoverComponent } from './ui/view/inventory/inventory-analytics/stock-turnover/stock-turnover.component';
import { SellLikelihoodComponent } from './ui/view/inventory/inventory-analytics/sell-likelihood/sell-likelihood.component';
import { PerformanceReportComponent } from './ui/view/inventory/inventory-analytics/performance-report/performance-report.component';
import { LogisticsComponent } from './ui/view/logistics/logistics.component';
import { RoutingQueueComponent } from './ui/view/logistics/routing-queue/routing-queue.component';
import { RouteApprovalComponent } from './ui/view/logistics/route-approval/route-approval.component';
import { RouteMapComponent } from './ui/view/logistics/route-map/route-map.component';
import { OrderDetailDrawerComponent } from './ui/view/logistics/order-detail-drawer/order-detail-drawer.component';
import { DeliveryRecordsComponent } from './ui/view/logistics/delivery-records/delivery-records.component';
import { ProofDetailDrawerComponent } from './ui/view/logistics/proof-detail-drawer/proof-detail-drawer.component';
import { RiderActivityComponent } from './ui/view/logistics/rider-activity/rider-activity.component';
import { AddRiderFormComponent } from './ui/view/logistics/add-rider-form/add-rider-form.component';
import { RiderDetailDrawerComponent } from './ui/view/logistics/rider-detail-drawer/rider-detail-drawer.component';
import { RouteBuilderComponent } from './ui/view/logistics/route-builder/route-builder.component';
import { StopChecklistComponent } from './ui/view/logistics/stop-checklist/stop-checklist.component';
import { LocationPickerComponent } from './ui/view/logistics/location-picker/location-picker.component';
import { RouteBuilderMapComponent } from './ui/view/logistics/route-builder-map/route-builder-map.component';
import {PoolOrderDetailDrawerComponent} from './ui/view/logistics/pool-order-detail-drawer/pool-order-detail-drawer.component';
import { BranchSelectorComponent } from './ui/shared-component/branch-selector/branch-selector.component';
import { BranchStockSummaryComponent } from './ui/shared-component/branch-stock-summary/branch-stock-summary.component';

@NgModule({
  declarations: [
    App,
    InventoryComponent,
    InventoryDashboardComponent,
    BranchSelectorComponent,
    BranchStockSummaryComponent,
    BranchInventoryComponent,
    BranchDetailComponent,
    BranchInventoryTableComponent,
    BranchTransferHistoryComponent,
    BranchInventoryFormComponent,
    BranchFormComponent,
    StockMovementComponent,
    StockMovementFormComponent,
    TransferWizardComponent,
    BulkTransferComponent,
    StockMovementDetailComponent,
    MovementApprovalComponent,
    RestockManagementComponent,
    RestockRequestFormComponent,
    RestockSuggestionComponent,
    RestockRequestListComponent,
    RestockSuggestionsPageComponent,
    ThresholdManagementComponent,
    RestockApprovalComponent,
    BranchManagerDashboardComponent,
    AnalyticsComponent,
    ProductAnalyticsComponent,
    BranchAnalyticsComponent,
    AffordabilityDashboardComponent,
    StockTurnoverComponent,
    SellLikelihoodComponent,
    PerformanceReportComponent,
    TableComponent,
    TableBodyDirective,
    SidebarComponent,
    NavTabComponent,
    RequestManagementComponent,
    RequestForQuotationListComponent,
    RequestForQuotationDraftsComponent,
    RequestForQuotationFormComponent,
    RequestForQuotationServiceFormComponent,
    ProcurementTypeSelectorComponent,
    RfqTemplateSelectorComponent,
    VendorSelectionComponent,
    SmartVendorSelectionComponent,
    DeliveryTrackingComponent,
    PaymentVoucherComponent,
    GrnListComponent,
    GrnDetailComponent,
    NotificationPanelComponent,
    ReceiptPreviewComponent,
    RequestForQuotationDetailComponent,
    RfqDetailWithQuotationsComponent,
    QuotationsDashboardComponent,
    QuotationDetailComponent,
    LpoPreviewComponent,
    RfqPreviewComponent,
    ApprovalInboxComponent,
    ApprovalRfqDetailComponent,
    InvoicesComponent,
    DocumentationHistoryComponent,
    ProcurementMessagingComponent,
    DashboardComponent,
    FinanceComponent,
    PipelineComponent,
    LpoComponent,
    VendorPortalComponent,
    // SalesDashboardComponent,
    DeliveryManagementComponent,
    PaymentProcessingComponent,
    SalesHubComponent,
    PerformanceComponent,
    DocumentsComponent,

    VendorRegistrationComponent,
    VendorDashboardComponent,
    VendorProfileComponent,
    VendorManagementComponent,
    VendorManagementDashboardComponent,
    VendorManagementListComponent,
    VendorManagementDetailComponent,
    VendorApprovalQueueComponent,

    OverviewComponent,
    VendorPerformanceComponent,
    RiskComponent,
    VendorDocumentsComponent,
    ActivityComponent,

    LogisticsComponent,
    RoutingQueueComponent,
    RouteApprovalComponent,
    RouteMapComponent,
    OrderDetailDrawerComponent,
    DeliveryRecordsComponent,
    ProofDetailDrawerComponent,
    RiderActivityComponent,
    AddRiderFormComponent,
    RiderDetailDrawerComponent,
    RouteBuilderComponent,
    StopChecklistComponent,
    LocationPickerComponent,
    RouteBuilderMapComponent,
    PoolOrderDetailDrawerComponent,
  ],
  imports: [
    // BrowserModule,
    // BrowserAnimationsModule,
    AppRoutingModule,
    ProductManagementComponent,
    CommonModule,
    SharedOverlayModule,
    TableModule,
    RippleModule,
    AngularEditorModule,
    DialogModule,
    CalendarModule,
    ToastModule,
    FormsModule,
    ReactiveFormsModule,
    SidebarModule,
    TabViewModule,
    ToolbarModule,
    ConfirmDialogModule,
    SplitButtonModule,
    PanelModule,
    DividerModule,
    TagModule,
    DropdownModule,
    OverlayPanelModule,
    StepperModule,
    InputTextModule,
    FloatLabelModule,
    RadioButtonModule,
    MultiSelectModule,
    EditorModule,
    MessagesModule,
    MessageModule,
    RippleModule,
    TableModule,
    MatExpansionModule,
    MatRadioModule,
    MatPaginatorModule,
    MatTableModule,
    MatRadioModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,

    MatIconModule,
    MatTabsModule,
    MatDatepickerModule,
    MatSelectModule,
    MatTooltipModule,
    MatButtonModule,
    MatDividerModule,
    MatMenuModule,
    PasswordModule,
    ButtonModule,
    NgSelectModule,
    NgApexchartsModule,
    ButtonComponent,
    ProfileCardComponent,
    ProfileInfoComponent,
    UserInterfaceComponent,
    BackButtonComponent,
    SalesAndTransactionsListComponent,
    SalesAndTransactionsDetailComponent,
    QuoteFormComponent,
    InvoiceListComponent,
    InvoiceFormComponent,
    CustomerListComponent,
    QuoteDetailComponent,
    InvoiceDetailComponent,
    CustomerFormComponent,
    ProductServiceCatalogListComponent,
    TemplateTypesComponent,
    VpStatusBadgeComponent,
    CommandPaletteComponent,
  ],
  exports: [TableComponent],
  schemas: [NO_ERRORS_SCHEMA],
  providers: [
    // provideBrowserGlobalErrorListeners()
    {
      provide: HTTP_INTERCEPTORS,
      useClass: AuthInterceptor,
      multi: true,
    },
    {
      provide: HTTP_INTERCEPTORS,
      useClass: ErrorToastInterceptor,
      multi: true,
    },
    {
      provide: JWT_OPTIONS,
      useValue: JWT_OPTIONS,
    },
    JwtHelperService,
    provideHttpClient(withInterceptorsFromDi()),
    ConfirmationService,
    MessageService,
    DecimalPipe,
  ],
  bootstrap: [App],
})
export class AppModule {}

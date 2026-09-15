// inventory.dto.ts
// ============================================================
// ENUMS
// ============================================================

export enum ProductStatus {
    ACTIVE = 'ACTIVE',
    INACTIVE = 'INACTIVE',
    DISCONTINUED = 'DISCONTINUED',
    OUT_OF_STOCK = 'OUT_OF_STOCK'
}

export enum MovementType {
    PURCHASE = 'PURCHASE',
    TRANSFER = 'TRANSFER',
    SALE = 'SALE',
    RETURN = 'RETURN',
    ADJUSTMENT = 'ADJUSTMENT',
    DAMAGED = 'DAMAGED'
}

export enum MovementStatus {
    PENDING = 'PENDING',
    IN_TRANSIT = 'IN_TRANSIT',
    COMPLETED = 'COMPLETED',
    CANCELLED = 'CANCELLED'
}

export enum RestockUrgency {
    LOW = 'LOW',
    MEDIUM = 'MEDIUM',
    HIGH = 'HIGH',
    CRITICAL = 'CRITICAL'
}

export enum RestockStatus {
    DRAFT = 'DRAFT',
    PENDING = 'PENDING',
    APPROVED = 'APPROVED',
    REJECTED = 'REJECTED',
    ORDERED = 'ORDERED',
    RECEIVED = 'RECEIVED'
}

export enum StockAlertType {
    LOW_STOCK = 'LOW_STOCK',
    OUT_OF_STOCK = 'OUT_OF_STOCK',
    EXPIRING = 'EXPIRING',
    OVER_STOCK = 'OVER_STOCK'
}

export enum StockAlertSeverity {
    INFO = 'INFO',
    WARNING = 'WARNING',
    CRITICAL = 'CRITICAL'
}

// ============================================================
// CORE MODELS
// ============================================================

// inventory.dto.ts - Add/Update Product interface

export interface Product {
    id: number;
    tenantId?: string;
    productId?: string; // For compatibility with sales service
    sku: string;
    name: string;
    description: string;
    category: string | Category; // Support both string and object
    /** Wire-canonical FK from the /products API. `category` above is resolved from this
     *  (via the cached Categories list) for display/back-compat — see productFromApi(). */
    categoryId?: number;
    // subCategory/brand/weight/dimensions/tags/variants have no field in the /products API —
    // it dropped them. Kept here as client-side-only: they display and edit locally but do NOT
    // round-trip through the real backend, so they're lost on reload once a product has only
    // ever been saved through the live API (see productFromApi()/productToApiPayload()).
    subCategory: string;
    brand: string;
    unitOfMeasure: 'EACH' | 'BOX' | 'KG' | 'LITER' | 'METER';
    /** Wire-canonical FK from the /products API. `unitOfMeasure` above is resolved from this
     *  (via the cached MeasurementUnits list) for display/back-compat. */
    measurementUnitId?: number;
    costPrice: number;
    sellingPrice: number;
    unitPrice?: number; // Alias for sellingPrice (for compatibility) — this is the API's canonical price field
    price?: number; // Another alias
    currency?: string;
    taxRate?: number;
    stockQuantity: number; // ← IMPORTANT: Add this for stock tracking
    weight: number;
    dimensions: {
        length: number;
        width: number;
        height: number;
    };
    images: string[];
    tags: string[];
    status: ProductStatus;
    // The /products API only supports a single supplierId, not a list — supplierIds (plural)
    // is kept for the existing multi-supplier UI, but only supplierIds[0] round-trips through
    // the real backend (as supplierId). See productToApiPayload()/productFromApi().
    supplierIds: string[];
    supplierId?: number;
    isComboProduct?: boolean;
    variants?: any[];
    createdAt: Date;
    updatedAt: Date;
}

/**
 * A product image — its own resource per the /products API (POST/DELETE
 * /products/{id}/images), not an embedded field on Product anymore. Note: the given endpoints
 * only add/remove one; there's no GET to list a product's images, so ProductImage.id below is
 * only ever known right after a successful create.
 */
export interface ProductImage {
    id?: number;
    productId: number;
    imageUrl: string;
    displayOrder: number;
}

// Add Category interface if not present
export interface Category {
    id: number;
    tenantId?: string;
    categoryId?: string;
    name: string;
    description?: string;
    createdAt: Date;
    updatedAt: Date;
}

// Add MeasurementUnit interface
export interface MeasurementUnit {
    id: number;
    tenantId?: string;
    unitId?: string;
    name: string;
    code: string;
    description?: string;
    createdAt: Date;
    updatedAt: Date;
}

// Add Supplier interface
export interface Supplier {
    id: number;
    tenantId?: string;
    supplierId?: string;
    name: string;
    email: string;
    phone: string;
    address: string;
    contactPerson: string;
    createdAt: Date;
    updatedAt: Date;
}

export interface Branch {
    id: number;
    tenantId?: string;
    name: string;
    code: string;
    // Widened from a fixed 'FLAGSHIP' | 'STANDARD' | 'MINI' union so users can add their own
    // custom branch types (see InventoryService.getBranchTypes()/createBranchType()).
    type: string;
    location: {
        address: string;
        city: string;
        state: string;
        country: string;
        postalCode: string;
        lat: number;
        lng: number;
    };
    contact: {
        phone: string;
        email: string;
        manager: string;
    };
    status: 'ACTIVE' | 'INACTIVE' | 'UNDER_CONSTRUCTION';
    createdAt: Date;
    updatedAt: Date;
}

export interface BranchInventory {
    id: number;
    tenantId?: string;
    branchId: string;
    branchName: string;
    productId: string;
    productName: string;
    sku: string;
    quantity: number;
    reorderPoint: number;
    reorderQuantity: number;
    safetyStock: number;
    sellingPrice: number;
    costPrice: number;
    lastUpdated: Date;
}

export interface StockMovement {
    id: number;
    tenantId?: string;
    productId: string;
    productName: string;
    sku: string;
    fromLocation: {
        type: 'WAREHOUSE' | 'BRANCH' | 'SUPPLIER';
        id: string;
        name: string;
    };
    toLocation: {
        type: 'WAREHOUSE' | 'BRANCH' | 'CUSTOMER';
        id: string;
        name: string;
    };
    quantity: number;
    movementType: MovementType;
    status: MovementStatus;
    cost: number;
    sellingPrice: number;
    batchNumber: string;
    expiryDate: Date;
    notes: string;
    scheduledDate?: Date | string;
    createdBy: string;
    createdByName: string;
    approvedBy: string;
    approvedByName: string;
    createdAt: Date;
    approvedAt: Date;
    completedAt: Date;
    updatedAt?: Date;
}

export interface RestockRequest {
    id: number;
    tenantId?: string;
    productId: string;
    productName: string;
    sku: string;
    branchId: string;
    branchName: string;
    currentStock: number;
    reorderPoint: number;
    safetyStock: number;
    requestedQuantity: number;
    approvedQuantity: number;
    preferredSupplier: string;
    costEstimate: number;
    urgency: RestockUrgency;
    status: RestockStatus;
    notes: string;
    createdBy: string;
    createdByName: string;
    approvedBy: string;
    approvedByName: string;
    createdAt: Date;
    approvedAt: Date;
    purchaseOrderId: string;
}

export interface StockAlert {
    id: number;
    tenantId?: string;
    type: StockAlertType;
    severity: StockAlertSeverity;
    productId: string;
    productName: string;
    sku: string;
    branchId: string;
    branchName: string;
    currentStock: number;
    threshold: number;
    message: string;
    isResolved: boolean;
    createdAt: Date;
    resolvedAt: Date;
}

export interface ProductPerformance {
    productId: string;
    productName: string;
    sku: string;
    category: string;
    totalSold: number;
    totalRevenue: number;
    totalProfit: number;
    averagePrice: number;
    sellThroughRate: number;
    stockTurnover: number;
    daysOfInventory: number;
    performanceScore: number;
    trend: 'UP' | 'DOWN' | 'STABLE';
    period: {
        start: Date;
        end: Date;
    };
}

// inventory.dto.ts - Update BranchStockSummary interface

export interface BranchStockSummary {
    branchId: string;
    branchName: string;
    totalProducts: number;
    totalStockValue: number;
    totalStockUnits: number;
    lowStockCount: number;
    outOfStockCount: number;
    stockTurnover?: number;        
    daysOfInventory?: number;      
    topSellingProducts?: {
        productId: string;
        productName: string;
        quantity: number;
        revenue: number;
    }[];
}

// ============================================================
// DASHBOARD MODELS
// ============================================================

export interface InventoryDashboardStats {
    totalSkus: number;
    totalStockValue: number;
    totalStockUnits: number;
    lowStockItems: number;
    outOfStockItems: number;
    totalBranches: number;
    monthlyMovementCount: number;
    monthlyMovementValue: number;
    averageStockTurnover: number;
    totalProfit: number;
    lastUpdated: Date;
}

export interface TopSellingProduct {
    productId: string;
    productName: string;
    quantitySold: number;
    revenue: number;
}

export interface InventoryDashboardData {
    stats: InventoryDashboardStats;
    alerts: StockAlert[];
    recentMovements: StockMovement[];
    topProducts: ProductPerformance[];
    branchSummaries: BranchStockSummary[];
    quickActions: QuickAction[];
}

export interface QuickAction {
    id: number;
    label: string;
    icon: string;
    route: string;
    color: string;
    description: string;
}

// ============================================================
// RESPONSE TYPES
// ============================================================

export interface ApiResponse<T> {
    success: boolean;
    data: T;
    message: string;
    errors?: string[];
}

export interface PaginatedResponse<T> {
    data: T[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

// ============================================================
// FILTER TYPES
// ============================================================

export interface ProductFilters {
    search?: string;
    searchTerm?: string;
    category?: string;
    brand?: string;
    status?: ProductStatus | 'ALL';
    minPrice?: number;
    maxPrice?: number;
    page?: number;
    limit?: number;
    size?: number;
    /** When set, restricts results to only these product ids — used to scope Product
     *  Management down to a single branch's inventory for a Branch Manager. */
    productIds?: string[];
}

export interface MovementFilters {
    type?: MovementType;
    status?: MovementStatus;
    branchId?: string;
    productId?: string;
    search?: string;
    dateFrom?: Date;
    dateTo?: Date;
    page?: number;
    limit?: number;
    size?: number;
}

export interface RestockFilters {
    status?: RestockStatus;
    urgency?: RestockUrgency;
    branchId?: string;
    productId?: string;
    dateFrom?: Date;
    dateTo?: Date;
    page?: number;
    limit?: number;
}

// ============================================================
// NOTIFICATIONS — email/SMS/in-app alerts between branch managers and admins
// ============================================================
// Same channel/status shape procurement's NotificationService already uses (see
// procurement.dto.ts's NotificationChannel/NotificationStatus/ProcurementNotification),
// so one backend notification pipeline can serve both domains — only the trigger types
// and recipient roles below are inventory-specific. This replaces the in-app-only
// DashboardNotification currently defined locally in
// branch-manager-dashboard.component.ts, which never leaves the browser.

export type InventoryNotificationChannel = 'EMAIL' | 'SMS' | 'IN_APP';

export type InventoryNotificationStatus = 'PENDING' | 'SENT' | 'DELIVERED' | 'FAILED';

export type InventoryRecipientRole = 'ADMIN' | 'BRANCH_MANAGER';

// Reuses StockAlertType for stock-driven alerts and adds the transfer/restock lifecycle
// events branch managers and admins also need to hear about.
export type InventoryAlertType =
    | StockAlertType
    | 'TRANSFER_PENDING_APPROVAL'
    | 'TRANSFER_APPROVED'
    | 'TRANSFER_REJECTED'
    | 'TRANSFER_CHANGES_REQUESTED'
    | 'RESTOCK_REQUESTED'
    | 'RESTOCK_APPROVED'
    | 'RESTOCK_REJECTED'
    | 'RESTOCK_RECEIVED';

export type InventoryAlertEntityType = 'STOCK_ALERT' | 'RESTOCK_REQUEST' | 'STOCK_MOVEMENT';

export interface InventoryAlertRecipient {
    id: string; // user id
    name: string;
    role: InventoryRecipientRole;
    email?: string;
    phone?: string;    // required when EMAIL/SMS channel targets this recipient
    branchId?: string; // set when role is BRANCH_MANAGER, to scope which branch they manage
}

/** Request payload for triggering an alert, e.g. POST /inventory/notifications/trigger. */
export interface TriggerInventoryAlertRequest {
    type: InventoryAlertType;
    channels: InventoryNotificationChannel[];
    recipients: InventoryAlertRecipient[];
    relatedEntityId: string;   // StockAlert / RestockRequest / StockMovement id
    relatedEntityType: InventoryAlertEntityType;
    branchId?: string;
    branchName?: string;
    subject: string;
    message: string;
    templateData?: Record<string, any>;
}

/** Delivery record for one recipient/channel — backs alert history and failed-send retries. */
export interface InventoryNotification {
    id: number;
    tenantId?: string;
    type: InventoryAlertType;
    channel: InventoryNotificationChannel;
    recipientId: string;
    recipientName: string;
    recipientRole: InventoryRecipientRole;
    recipientEmail?: string;
    recipientPhone?: string;
    subject: string;
    message: string;
    status: InventoryNotificationStatus;
    sentAt?: Date;
    deliveredAt?: Date;
    failureReason?: string;
    retryCount: number;
    relatedEntityId: string;
    relatedEntityType: InventoryAlertEntityType;
    branchId?: string;
    branchName?: string;
    createdAt: Date;
}

export interface InventoryAlertFilters {
    type?: InventoryAlertType;
    channel?: InventoryNotificationChannel;
    status?: InventoryNotificationStatus;
    recipientRole?: InventoryRecipientRole;
    branchId?: string;
    dateFrom?: Date;
    dateTo?: Date;
    page?: number;
    limit?: number;
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

export function getStockStatus(quantity: number, reorderPoint: number, safetyStock: number): 'CRITICAL' | 'LOW' | 'NORMAL' | 'OVERSTOCK' {
    if (quantity <= 0) return 'CRITICAL';
    if (quantity <= safetyStock) return 'CRITICAL';
    if (quantity <= reorderPoint) return 'LOW';
    if (quantity > reorderPoint * 3) return 'OVERSTOCK';
    return 'NORMAL';
}

export function getStockStatusColor(status: 'CRITICAL' | 'LOW' | 'NORMAL' | 'OVERSTOCK'): string {
    const map = {
        'CRITICAL': '#DC2626',
        'LOW': '#F59E0B',
        'NORMAL': '#2EB270',
        'OVERSTOCK': '#3B82F6'
    };
    return map[status];
}

export function getStockStatusLabel(status: 'CRITICAL' | 'LOW' | 'NORMAL' | 'OVERSTOCK'): string {
    const map = {
        'CRITICAL': 'Critical',
        'LOW': 'Low Stock',
        'NORMAL': 'Normal',
        'OVERSTOCK': 'Overstock'
    };
    return map[status];
}

/** True while a movement has an admin "Request Changes" note that hasn't been addressed yet —
 *  i.e. the last "Changes requested:" marker in its notes is more recent than any "Changes made:"
 *  marker. Both markers are plain text appended to `notes` (see MovementApprovalComponent /
 *  StockMovementComponent's request-changes flow, and StockMovementFormComponent's save()).
 *  Used to hide Approve/Reject/Request Changes while a request is still outstanding, so nobody
 *  approves or re-requests changes on a transfer that's already waiting on an edit. */
export function hasUnresolvedChangeRequest(movement: { notes?: string } | null | undefined): boolean {
    const notes = movement?.notes || '';
    const lastRequested = notes.lastIndexOf('Changes requested:');
    if (lastRequested === -1) return false;
    const lastMade = notes.lastIndexOf('Changes made:');
    return lastMade < lastRequested;
}

export function getMovementTypeLabel(type: MovementType | string): string {
    const map: Record<string, string> = {
        [MovementType.PURCHASE]: 'Purchase',
        [MovementType.TRANSFER]: 'Transfer',
        [MovementType.SALE]: 'Sale',
        [MovementType.RETURN]: 'Return',
        [MovementType.ADJUSTMENT]: 'Adjustment',
        [MovementType.DAMAGED]: 'Damaged'
    };
    if (map[type]) return map[type];
    // Custom movement types are shown in Title Case no matter how they were typed in.
    return String(type).toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
}

export function getMovementTypeIcon(type: MovementType | string): string {
    const map: Record<string, string> = {
        [MovementType.PURCHASE]: 'fa-truck-loading',
        [MovementType.TRANSFER]: 'fa-exchange-alt',
        [MovementType.SALE]: 'fa-shopping-cart',
        [MovementType.RETURN]: 'fa-undo-alt',
        [MovementType.ADJUSTMENT]: 'fa-sliders-h',
        [MovementType.DAMAGED]: 'fa-exclamation-triangle'
    };
    return map[type] || 'fa-box';
}

export function getMovementStatusLabel(status: MovementStatus): string {
    const map: Record<MovementStatus, string> = {
        [MovementStatus.PENDING]: 'Pending',
        [MovementStatus.IN_TRANSIT]: 'In Transit',
        [MovementStatus.COMPLETED]: 'Completed',
        [MovementStatus.CANCELLED]: 'Cancelled'
    };
    return map[status] || status;
}

export function getInventoryAlertTypeLabel(type: InventoryAlertType): string {
    const map: Record<string, string> = {
        [StockAlertType.LOW_STOCK]: 'Low Stock',
        [StockAlertType.OUT_OF_STOCK]: 'Out of Stock',
        [StockAlertType.EXPIRING]: 'Expiring Stock',
        [StockAlertType.OVER_STOCK]: 'Overstock',
        TRANSFER_PENDING_APPROVAL: 'Transfer Pending Approval',
        TRANSFER_APPROVED: 'Transfer Approved',
        TRANSFER_REJECTED: 'Transfer Rejected',
        TRANSFER_CHANGES_REQUESTED: 'Transfer Changes Requested',
        RESTOCK_REQUESTED: 'Restock Requested',
        RESTOCK_APPROVED: 'Restock Approved',
        RESTOCK_REJECTED: 'Restock Rejected',
        RESTOCK_RECEIVED: 'Restock Received'
    };
    return map[type] || String(type);
}
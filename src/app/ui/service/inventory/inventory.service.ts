// inventory.service.ts
// ============================================================
// IMPORTS
// ============================================================
import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, BehaviorSubject, of, throwError, forkJoin } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { environment } from '../../shared-component/service/environments/environment';
import {
  Product,
  ProductPerformance,
  BranchInventory,
  Branch,
  InventoryDashboardData,
  InventoryDashboardStats,
  TopSellingProduct,
  QuickAction,
  ProductFilters,
  MovementFilters,
  RestockFilters,
  getStockStatus,
  getStockStatusLabel,
  getStockStatusColor,
  ProductStatus,
  StockMovement,
  RestockRequest,
  StockAlert,
  BranchStockSummary,
  ApiResponse,
  PaginatedResponse,
  MovementType,
  MovementStatus,
  RestockStatus,
  RestockUrgency,
  StockAlertType,
  StockAlertSeverity,
  Supplier,
  Category,
  MeasurementUnit,
  ProductImage,
  InventoryNotification,
  TriggerInventoryAlertRequest,
  InventoryAlertFilters
} from '../../domain/inventory/inventory.dto';

// ============================================================
// LOCAL STORAGE KEYS & MOCK DATA
// ============================================================

const LOCAL_KEYS = {
  DASHBOARD: 'inventory_dashboard',
  PRODUCTS: 'inventory_products',
  BRANCHES: 'inventory_branches',
  BRANCH_INVENTORY: 'inventory_branch_inventory',
  MOVEMENTS: 'inventory_movements',
  CATEGORIES: 'inventory_categories',
  MEASUREMENT_UNITS: 'inventory_measurement_units',
  SUPPLIERS: 'inventory_suppliers',
  BRANCH_TYPES: 'inventory_branch_types',
  MOVEMENT_TYPES: 'inventory_movement_types',
  LOCATION_TYPES: 'inventory_location_types',
  GENERIC_LOCATIONS: 'inventory_generic_locations',
  NOTIFICATIONS: 'inventory_notifications',
  PRODUCT_PERFORMANCE_FALLBACK: 'inventory_product_performance_fallback'
};

const MOCK_BRANCH_TYPES: string[] = ['STANDARD', 'FLAGSHIP', 'MINI'];

const MOCK_MOVEMENT_TYPES: string[] = ['PURCHASE', 'TRANSFER', 'SALE', 'RETURN', 'ADJUSTMENT', 'DAMAGED'];

// 'BRANCH' locations come from the real Branches collection, and 'SUPPLIER' locations from the
// real Suppliers collection — both already exist as proper reference data. WAREHOUSE/CUSTOMER
// (and any custom location type a user adds) have no such collection in this module, so they're
// backed by this flat, extensible list instead.
const MOCK_LOCATION_TYPES: string[] = ['WAREHOUSE', 'BRANCH', 'SUPPLIER', 'CUSTOMER'];

const MOCK_GENERIC_LOCATIONS: { id: string; type: string; name: string }[] = [
  { id: 'loc-wh-1', type: 'WAREHOUSE', name: 'Central Warehouse' },
  { id: 'loc-wh-2', type: 'WAREHOUSE', name: 'Apapa Bonded Warehouse' },
  { id: 'loc-wh-3', type: 'WAREHOUSE', name: 'Kano Distribution Warehouse' },
  { id: 'loc-wh-4', type: 'WAREHOUSE', name: 'Onitsha Overflow Warehouse' },
  { id: 'loc-cust-1', type: 'CUSTOMER', name: 'Walk-in Customer' },
  { id: 'loc-cust-2', type: 'CUSTOMER', name: 'Julius Berger Nigeria Plc' },
  { id: 'loc-cust-3', type: 'CUSTOMER', name: 'Costain West Africa' },
  { id: 'loc-cust-4', type: 'CUSTOMER', name: 'Setraco Nigeria Ltd' },
  { id: 'loc-cust-5', type: 'CUSTOMER', name: 'PW Nigeria Ltd' }
];

// ---------------------------------------------------
// MOCK DATA (kept unchanged from original file)
// ---------------------------------------------------

const MOCK_BRANCHES: any[] = [
  {
    id: 1,
    name: 'Lagos Main Warehouse',
    code: 'LGS-MW',
    type: 'FLAGSHIP',
    location: { address: '14 Apapa Wharf Road', city: 'Lagos', state: 'Lagos', country: 'Nigeria', postalCode: '100001', lat: 6.4281, lng: 3.4219 },
    contact: { phone: '+234-1-555-0101', email: 'lagos.main@erpsales.ng', manager: 'John Doe' },
    status: 'ACTIVE',
    createdAt: new Date('2023-01-15'),
    updatedAt: new Date('2026-08-01')
  },
  {
    id: 2,
    name: 'Abuja Distribution Hub',
    code: 'ABJ-DH',
    type: 'FLAGSHIP',
    location: { address: '7 Industrial Layout, Gwagwalada', city: 'Abuja', state: 'FCT', country: 'Nigeria', postalCode: '900108', lat: 8.9403, lng: 7.3775 },
    contact: { phone: '+234-9-555-0202', email: 'abuja.hub@erpsales.ng', manager: 'Emeka Obi' },
    status: 'ACTIVE',
    createdAt: new Date('2023-03-10'),
    updatedAt: new Date('2026-08-01')
  },
  {
    id: 3,
    name: 'Port Harcourt Store',
    code: 'PHC-ST',
    type: 'STANDARD',
    location: { address: '22 Trans-Amadi Industrial Road', city: 'Port Harcourt', state: 'Rivers', country: 'Nigeria', postalCode: '500211', lat: 4.8396, lng: 7.0335 },
    contact: { phone: '+234-84-555-0303', email: 'ph.store@erpsales.ng', manager: 'Mary Okoye' },
    status: 'ACTIVE',
    createdAt: new Date('2023-06-20'),
    updatedAt: new Date('2026-07-15')
  },
  {
    id: 4,
    name: 'Kano Outlet',
    code: 'KAN-OT',
    type: 'STANDARD',
    location: { address: '5 Bompai Industrial Estate', city: 'Kano', state: 'Kano', country: 'Nigeria', postalCode: '700233', lat: 12.0022, lng: 8.5920 },
    contact: { phone: '+234-64-555-0404', email: 'kano.outlet@erpsales.ng', manager: 'Aisha Bello' },
    status: 'ACTIVE',
    createdAt: new Date('2023-09-05'),
    updatedAt: new Date('2026-07-20')
  },
  {
    id: 5,
    name: 'Ibadan Regional Store',
    code: 'IBD-RS',
    type: 'STANDARD',
    location: { address: '18 Oluyole Industrial Estate', city: 'Ibadan', state: 'Oyo', country: 'Nigeria', postalCode: '200252', lat: 7.3775, lng: 3.9470 },
    contact: { phone: '+234-22-555-0505', email: 'ibadan.store@erpsales.ng', manager: 'Tunde Adeyemi' },
    status: 'ACTIVE',
    createdAt: new Date('2024-01-10'),
    updatedAt: new Date('2026-06-30')
  },
  {
    id: 6,
    name: 'Enugu Express Depot',
    code: 'ENU-XD',
    type: 'MINI',
    location: { address: '3 Independence Layout', city: 'Enugu', state: 'Enugu', country: 'Nigeria', postalCode: '400221', lat: 6.4584, lng: 7.5464 },
    contact: { phone: '+234-42-555-0606', email: 'enugu.depot@erpsales.ng', manager: 'Chioma Nwosu' },
    status: 'ACTIVE',
    createdAt: new Date('2024-04-15'),
    updatedAt: new Date('2026-05-20')
  }
];

const MOCK_STATS: InventoryDashboardStats = {
  totalSkus: 1420,
  totalStockValue: 245000000,
  totalStockUnits: 85200,
  lowStockItems: 14,
  outOfStockItems: 3,
  totalBranches: 6,
  monthlyMovementCount: 324,
  monthlyMovementValue: 48500000,
  averageStockTurnover: 4.2,
  totalProfit: 12400000,
  lastUpdated: new Date()
};

const MOCK_ALERTS: StockAlert[] = [
  {
    id: 1,
    type: StockAlertType.OUT_OF_STOCK,
    severity: StockAlertSeverity.CRITICAL,
    productId: '1',
    productName: 'Cement Dangote Grade 42.5R',
    sku: 'CEM-DG-425',
    branchId: '1',
    branchName: 'Lagos Main Warehouse',
    currentStock: 0,
    threshold: 100,
    message: 'Dangote Cement is completely out of stock at Lagos Warehouse!',
    isResolved: false,
    createdAt: new Date(),
    resolvedAt: new Date()
  },
  {
    id: 2,
    type: StockAlertType.LOW_STOCK,
    severity: StockAlertSeverity.WARNING,
    productId: '2',
    productName: 'Iron Rod 16mm (Per Ton)',
    sku: 'IRN-16MM-TON',
    branchId: '2',
    branchName: 'Abuja Distribution Hub',
    currentStock: 12,
    threshold: 50,
    message: 'Iron Rod 16mm is below the reorder point of 50 tons.',
    isResolved: false,
    createdAt: new Date(Date.now() - 3600000),
    resolvedAt: new Date()
  },
  {
    id: 3,
    type: StockAlertType.EXPIRING,
    severity: StockAlertSeverity.INFO,
    productId: '3',
    productName: 'Wall Paint White Satin 20L',
    sku: 'PNT-WS-20L',
    branchId: '3',
    branchName: 'Port Harcourt Store',
    currentStock: 85,
    threshold: 10,
    message: 'Premium Satin Paint batch #2024-09 expires in 30 days.',
    isResolved: false,
    createdAt: new Date(Date.now() - 7200000),
    resolvedAt: new Date()
  }
];

const MOCK_MOVEMENTS: StockMovement[] = [
  {
    id: 1,
    productId: '1',
    productName: 'Cement Dangote Grade 42.5R',
    sku: 'CEM-DG-425',
    fromLocation: { type: 'SUPPLIER', id: '1', name: 'Dangote Cement Factory' },
    toLocation: { type: 'WAREHOUSE', id: '1', name: 'Lagos Main Warehouse' },
    quantity: 600,
    movementType: MovementType.PURCHASE,
    status: MovementStatus.COMPLETED,
    cost: 3600000,
    sellingPrice: 4200000,
    batchNumber: 'BAT-2026-08',
    expiryDate: new Date(Date.now() + 180 * 24 * 3600000),
    notes: 'Restock purchase order PO-8892',
    createdBy: 'usr-1',
    createdByName: 'John Doe',
    approvedBy: 'usr-2',
    approvedByName: 'Jane Smith',
    createdAt: new Date(Date.now() - 1800000),
    approvedAt: new Date(Date.now() - 1700000),
    completedAt: new Date(Date.now() - 1200000)
  },
  {
    id: 2,
    productId: '2',
    productName: 'Iron Rod 16mm (Per Ton)',
    sku: 'IRN-16MM-TON',
    fromLocation: { type: 'WAREHOUSE', id: '1', name: 'Lagos Main Warehouse' },
    toLocation: { type: 'BRANCH', id: '2', name: 'Abuja Distribution Hub' },
    quantity: 45,
    movementType: MovementType.TRANSFER,
    status: MovementStatus.IN_TRANSIT,
    cost: 13500000,
    sellingPrice: 15750000,
    batchNumber: 'BAT-2026-02',
    expiryDate: new Date(),
    notes: 'Inter-branch stock transfer to meet sudden demand',
    createdBy: 'usr-1',
    createdByName: 'John Doe',
    approvedBy: 'usr-2',
    approvedByName: 'Jane Smith',
    createdAt: new Date(Date.now() - 5400000),
    approvedAt: new Date(Date.now() - 5200000),
    completedAt: new Date()
  },
  {
    id: 3,
    productId: '3',
    productName: 'Wall Paint White Satin 20L',
    sku: 'PNT-WS-20L',
    fromLocation: { type: 'BRANCH', id: '3', name: 'Port Harcourt Store' },
    toLocation: { type: 'CUSTOMER', id: 'cust-1', name: 'Julius Berger Site C' },
    quantity: 120,
    movementType: MovementType.SALE,
    status: MovementStatus.COMPLETED,
    cost: 2160000,
    sellingPrice: 2880000,
    batchNumber: 'BAT-2025-11',
    expiryDate: new Date(Date.now() + 365 * 24 * 3600000),
    notes: 'Invoice INV-10023 sales delivery',
    createdBy: 'usr-4',
    createdByName: 'Mary Okoye',
    approvedBy: 'usr-4',
    approvedByName: 'Mary Okoye',
    createdAt: new Date(Date.now() - 10800000),
    approvedAt: new Date(Date.now() - 10800000),
    completedAt: new Date(Date.now() - 9000000)
  },
  {
    id: 4,
    productId: '4',
    productName: 'PVC Pipes 4-inch (Length 6m)',
    sku: 'PVC-4IN-6M',
    fromLocation: { type: 'SUPPLIER', id: '2', name: 'Niger Delta Plastics Ltd' },
    toLocation: { type: 'BRANCH', id: '3', name: 'Port Harcourt Store' },
    quantity: 800,
    movementType: MovementType.PURCHASE,
    status: MovementStatus.COMPLETED,
    cost: 4800000,
    sellingPrice: 6400000,
    batchNumber: 'BAT-2026-07',
    expiryDate: new Date(Date.now() + 730 * 24 * 3600000),
    notes: 'Bulk purchase for PH construction season',
    createdBy: 'usr-4',
    createdByName: 'Mary Okoye',
    approvedBy: 'usr-2',
    approvedByName: 'Jane Smith',
    createdAt: new Date(Date.now() - 2 * 86400000),
    approvedAt: new Date(Date.now() - 2 * 86400000 + 3600000),
    completedAt: new Date(Date.now() - 2 * 86400000 + 7200000)
  },
  {
    id: 5,
    productId: '5',
    productName: 'Floor Tiles 60x60cm (Box)',
    sku: 'TIL-FLR-6060',
    fromLocation: { type: 'BRANCH', id: '2', name: 'Abuja Distribution Hub' },
    toLocation: { type: 'CUSTOMER', id: 'cust-2', name: 'Maitama Estate Project' },
    quantity: 250,
    movementType: MovementType.SALE,
    status: MovementStatus.COMPLETED,
    cost: 5000000,
    sellingPrice: 6250000,
    batchNumber: 'BAT-2026-05',
    expiryDate: new Date(Date.now() + 1460 * 24 * 3600000),
    notes: 'Maitama residential estate Phase 2 finishing',
    createdBy: 'usr-3',
    createdByName: 'Emeka Obi',
    approvedBy: 'usr-3',
    approvedByName: 'Emeka Obi',
    createdAt: new Date(Date.now() - 3 * 86400000),
    approvedAt: new Date(Date.now() - 3 * 86400000 + 1800000),
    completedAt: new Date(Date.now() - 3 * 86400000 + 4 * 3600000)
  },
  {
    id: 6,
    productId: '1',
    productName: 'Cement Dangote Grade 42.5R',
    sku: 'CEM-DG-425',
    fromLocation: { type: 'WAREHOUSE', id: '1', name: 'Lagos Main Warehouse' },
    toLocation: { type: 'BRANCH', id: '4', name: 'Kano Outlet' },
    quantity: 200,
    movementType: MovementType.TRANSFER,
    status: MovementStatus.PENDING,
    cost: 1200000,
    sellingPrice: 1500000,
    batchNumber: 'BAT-2026-08',
    expiryDate: new Date(Date.now() + 180 * 24 * 3600000),
    notes: 'Scheduled Kano resupply — awaiting driver allocation',
    createdBy: 'usr-1',
    createdByName: 'John Doe',
    approvedBy: '',
    approvedByName: '',
    createdAt: new Date(Date.now() - 4 * 3600000),
    approvedAt: new Date(),
    completedAt: new Date()
  },
  {
    id: 7,
    productId: '6',
    productName: 'Electrical Cable 1.5mm (100m Roll)',
    sku: 'ELC-CBL-15-100',
    fromLocation: { type: 'SUPPLIER', id: '3', name: 'Coleman Cables Nigeria' },
    toLocation: { type: 'WAREHOUSE', id: '1', name: 'Lagos Main Warehouse' },
    quantity: 500,
    movementType: MovementType.PURCHASE,
    status: MovementStatus.IN_TRANSIT,
    cost: 7500000,
    sellingPrice: 9500000,
    batchNumber: 'BAT-2026-08',
    expiryDate: new Date(Date.now() + 365 * 24 * 3600000),
    notes: 'Large restock PO-9120 from Coleman',
    createdBy: 'usr-2',
    createdByName: 'Jane Smith',
    approvedBy: 'usr-2',
    approvedByName: 'Jane Smith',
    createdAt: new Date(Date.now() - 86400000),
    approvedAt: new Date(Date.now() - 86400000 + 1800000),
    completedAt: new Date()
  },
  {
    id: 8,
    productId: '7',
    productName: 'Roofing Sheet Long Span (Per Meter)',
    sku: 'ROF-LS-MTR',
    fromLocation: { type: 'WAREHOUSE', id: '1', name: 'Lagos Main Warehouse' },
    toLocation: { type: 'CUSTOMER', id: 'cust-3', name: 'Lekki Phase 2 Developers' },
    quantity: 1500,
    movementType: MovementType.SALE,
    status: MovementStatus.COMPLETED,
    cost: 9000000,
    sellingPrice: 12750000,
    batchNumber: 'BAT-2026-06',
    expiryDate: new Date(Date.now() + 3650 * 24 * 3600000),
    notes: 'INV-10045 — Lekki roofing project delivery',
    createdBy: 'usr-1',
    createdByName: 'John Doe',
    approvedBy: 'usr-1',
    approvedByName: 'John Doe',
    createdAt: new Date(Date.now() - 5 * 86400000),
    approvedAt: new Date(Date.now() - 5 * 86400000 + 3600000),
    completedAt: new Date(Date.now() - 5 * 86400000 + 6 * 3600000)
  },
  {
    id: 9,
    productId: '3',
    productName: 'Wall Paint White Satin 20L',
    sku: 'PNT-WS-20L',
    fromLocation: { type: 'BRANCH', id: '2', name: 'Abuja Distribution Hub' },
    toLocation: { type: 'BRANCH', id: '2', name: 'Abuja Distribution Hub' },
    quantity: 30,
    movementType: MovementType.RETURN,
    status: MovementStatus.COMPLETED,
    cost: 540000,
    sellingPrice: 720000,
    batchNumber: 'BAT-2025-11',
    expiryDate: new Date(Date.now() + 335 * 24 * 3600000),
    notes: 'Customer return — incorrect colour delivered',
    createdBy: 'usr-3',
    createdByName: 'Emeka Obi',
    approvedBy: 'usr-2',
    approvedByName: 'Jane Smith',
    createdAt: new Date(Date.now() - 6 * 86400000),
    approvedAt: new Date(Date.now() - 6 * 86400000 + 7200000),
    completedAt: new Date(Date.now() - 6 * 86400000 + 9 * 3600000)
  },
  {
    id: 10,
    productId: '2',
    productName: 'Iron Rod 16mm (Per Ton)',
    sku: 'IRN-16MM-TON',
    fromLocation: { type: 'WAREHOUSE', id: '1', name: 'Lagos Main Warehouse' },
    toLocation: { type: 'BRANCH', id: '1', name: 'Lagos Main Warehouse' },
    quantity: 5,
    movementType: MovementType.DAMAGED,
    status: MovementStatus.COMPLETED,
    cost: 1750000,
    sellingPrice: 0,
    batchNumber: 'BAT-2026-01',
    expiryDate: new Date(),
    notes: 'Damaged during forklift incident — wrote off 5 tons',
    createdBy: 'usr-5',
    createdByName: 'Tunde Adeyemi',
    approvedBy: 'usr-2',
    approvedByName: 'Jane Smith',
    createdAt: new Date(Date.now() - 7 * 86400000),
    approvedAt: new Date(Date.now() - 7 * 86400000 + 3600000),
    completedAt: new Date(Date.now() - 7 * 86400000 + 5 * 3600000)
  },
  {
    id: 11,
    productId: '8',
    productName: 'Plywood Sheet 18mm (4x8ft)',
    sku: 'PLY-18MM-4X8',
    fromLocation: { type: 'SUPPLIER', id: '4', name: 'Tropical Timber Mills' },
    toLocation: { type: 'BRANCH', id: '2', name: 'Abuja Distribution Hub' },
    quantity: 300,
    movementType: MovementType.PURCHASE,
    status: MovementStatus.COMPLETED,
    cost: 9000000,
    sellingPrice: 11250000,
    batchNumber: 'BAT-2026-07',
    expiryDate: new Date(Date.now() + 365 * 24 * 3600000),
    notes: 'Abuja quarterly timber restock PO-8750',
    createdBy: 'usr-3',
    createdByName: 'Emeka Obi',
    approvedBy: 'usr-2',
    approvedByName: 'Jane Smith',
    createdAt: new Date(Date.now() - 8 * 86400000),
    approvedAt: new Date(Date.now() - 8 * 86400000 + 2 * 3600000),
    completedAt: new Date(Date.now() - 8 * 86400000 + 10 * 3600000)
  },
  {
    id: 12,
    productId: '4',
    productName: 'PVC Pipes 4-inch (Length 6m)',
    sku: 'PVC-4IN-6M',
    fromLocation: { type: 'BRANCH', id: '3', name: 'Port Harcourt Store' },
    toLocation: { type: 'BRANCH', id: '3', name: 'Port Harcourt Store' },
    quantity: 50,
    movementType: MovementType.ADJUSTMENT,
    status: MovementStatus.COMPLETED,
    cost: 300000,
    sellingPrice: 0,
    batchNumber: 'BAT-2026-07',
    expiryDate: new Date(Date.now() + 730 * 24 * 3600000),
    notes: 'Cycle count correction — 50 units extra found during audit',
    createdBy: 'usr-4',
    createdByName: 'Mary Okoye',
    approvedBy: 'usr-2',
    approvedByName: 'Jane Smith',
    createdAt: new Date(Date.now() - 9 * 86400000),
    approvedAt: new Date(Date.now() - 9 * 86400000 + 3600000),
    completedAt: new Date(Date.now() - 9 * 86400000 + 4 * 3600000)
  },
  {
    id: 13,
    productId: '5',
    productName: 'Floor Tiles 60x60cm (Box)',
    sku: 'TIL-FLR-6060',
    fromLocation: { type: 'SUPPLIER', id: '5', name: 'Porcelain Palace Lagos' },
    toLocation: { type: 'WAREHOUSE', id: '1', name: 'Lagos Main Warehouse' },
    quantity: 1000,
    movementType: MovementType.PURCHASE,
    status: MovementStatus.IN_TRANSIT,
    cost: 20000000,
    sellingPrice: 25000000,
    batchNumber: 'BAT-2026-08',
    expiryDate: new Date(Date.now() + 1460 * 24 * 3600000),
    notes: 'Major restock ahead of festive season — PO-9201',
    createdBy: 'usr-1',
    createdByName: 'John Doe',
    approvedBy: 'usr-2',
    approvedByName: 'Jane Smith',
    createdAt: new Date(Date.now() - 12 * 3600000),
    approvedAt: new Date(Date.now() - 11 * 3600000),
    completedAt: new Date()
  },
  {
    id: 14,
    productId: '6',
    productName: 'Electrical Cable 1.5mm (100m Roll)',
    sku: 'ELC-CBL-15-100',
    fromLocation: { type: 'WAREHOUSE', id: '1', name: 'Lagos Main Warehouse' },
    toLocation: { type: 'CUSTOMER', id: 'cust-5', name: 'Eko Atlantic Contractors' },
    quantity: 200,
    movementType: MovementType.SALE,
    status: MovementStatus.IN_TRANSIT,
    cost: 3000000,
    sellingPrice: 3800000,
    batchNumber: 'BAT-2026-08',
    expiryDate: new Date(Date.now() + 365 * 24 * 3600000),
    notes: 'INV-10067 — Eko Atlantic electrical fitout delivery',
    createdBy: 'usr-1',
    createdByName: 'John Doe',
    approvedBy: 'usr-1',
    approvedByName: 'John Doe',
    createdAt: new Date(Date.now() - 8 * 3600000),
    approvedAt: new Date(Date.now() - 7 * 3600000),
    completedAt: new Date()
  },
  {
    id: 15,
    productId: '7',
    productName: 'Roofing Sheet Long Span (Per Meter)',
    sku: 'ROF-LS-MTR',
    fromLocation: { type: 'BRANCH', id: '4', name: 'Kano Outlet' },
    toLocation: { type: 'CUSTOMER', id: 'cust-6', name: 'Sabon Gari Housing Corp' },
    quantity: 600,
    movementType: MovementType.SALE,
    status: MovementStatus.PENDING,
    cost: 3600000,
    sellingPrice: 5100000,
    batchNumber: 'BAT-2026-06',
    expiryDate: new Date(Date.now() + 3650 * 24 * 3600000),
    notes: 'INV-10072 — Kano housing project roofing supply',
    createdBy: 'usr-6',
    createdByName: 'Aisha Bello',
    approvedBy: '',
    approvedByName: '',
    createdAt: new Date(Date.now() - 2 * 3600000),
    approvedAt: new Date(),
    completedAt: new Date()
  },
  {
    id: 16,
    productId: '8',
    productName: 'Plywood Sheet 18mm (4x8ft)',
    sku: 'PLY-18MM-4X8',
    fromLocation: { type: 'BRANCH', id: '2', name: 'Abuja Distribution Hub' },
    toLocation: { type: 'CUSTOMER', id: 'cust-7', name: 'Asokoro Mall Fit-Out' },
    quantity: 80,
    movementType: MovementType.SALE,
    status: MovementStatus.COMPLETED,
    cost: 2400000,
    sellingPrice: 3200000,
    batchNumber: 'BAT-2026-07',
    expiryDate: new Date(Date.now() + 365 * 24 * 3600000),
    notes: 'INV-10058 — Asokoro mall interior fit-out',
    createdBy: 'usr-3',
    createdByName: 'Emeka Obi',
    approvedBy: 'usr-3',
    approvedByName: 'Emeka Obi',
    createdAt: new Date(Date.now() - 11 * 86400000),
    approvedAt: new Date(Date.now() - 11 * 86400000 + 3600000),
    completedAt: new Date(Date.now() - 11 * 86400000 + 8 * 3600000)
  },
  {
    id: 17,
    productId: '9',
    productName: 'Sanitary Ware — WC Suite Set',
    sku: 'SAN-WC-SUITE',
    fromLocation: { type: 'SUPPLIER', id: '6', name: 'Roca Sanitaryware Nigeria' },
    toLocation: { type: 'BRANCH', id: '3', name: 'Port Harcourt Store' },
    quantity: 40,
    movementType: MovementType.PURCHASE,
    status: MovementStatus.COMPLETED,
    cost: 8000000,
    sellingPrice: 10400000,
    batchNumber: 'BAT-2026-06',
    expiryDate: new Date(Date.now() + 1825 * 24 * 3600000),
    notes: 'PH store replenishment for high-end sanitary ware',
    createdBy: 'usr-4',
    createdByName: 'Mary Okoye',
    approvedBy: 'usr-2',
    approvedByName: 'Jane Smith',
    createdAt: new Date(Date.now() - 13 * 86400000),
    approvedAt: new Date(Date.now() - 13 * 86400000 + 4 * 3600000),
    completedAt: new Date(Date.now() - 13 * 86400000 + 12 * 3600000)
  },
  {
    id: 18,
    productId: '2',
    productName: 'Iron Rod 16mm (Per Ton)',
    sku: 'IRN-16MM-TON',
    fromLocation: { type: 'SUPPLIER', id: '7', name: 'Delta Steel Company' },
    toLocation: { type: 'WAREHOUSE', id: '1', name: 'Lagos Main Warehouse' },
    quantity: 120,
    movementType: MovementType.PURCHASE,
    status: MovementStatus.COMPLETED,
    cost: 42000000,
    sellingPrice: 50400000,
    batchNumber: 'BAT-2026-08',
    expiryDate: new Date(Date.now() + 1825 * 24 * 3600000),
    notes: 'PO-9100 — Emergency restock post-depletion',
    createdBy: 'usr-1',
    createdByName: 'John Doe',
    approvedBy: 'usr-2',
    approvedByName: 'Jane Smith',
    createdAt: new Date(Date.now() - 14 * 86400000),
    approvedAt: new Date(Date.now() - 14 * 86400000 + 5 * 3600000),
    completedAt: new Date(Date.now() - 14 * 86400000 + 14 * 3600000)
  },
  {
    id: 19,
    productId: '3',
    productName: 'Wall Paint White Satin 20L',
    sku: 'PNT-WS-20L',
    fromLocation: { type: 'BRANCH', id: '1', name: 'Lagos Main Warehouse' },
    toLocation: { type: 'BRANCH', id: '4', name: 'Kano Outlet' },
    quantity: 60,
    movementType: MovementType.TRANSFER,
    status: MovementStatus.CANCELLED,
    cost: 1080000,
    sellingPrice: 1440000,
    batchNumber: 'BAT-2025-11',
    expiryDate: new Date(Date.now() + 335 * 24 * 3600000),
    notes: 'Cancelled — recipient branch found alternative local supplier',
    createdBy: 'usr-6',
    createdByName: 'Aisha Bello',
    approvedBy: '',
    approvedByName: '',
    createdAt: new Date(Date.now() - 16 * 86400000),
    approvedAt: new Date(),
    completedAt: new Date()
  },
  {
    id: 20,
    productId: '9',
    productName: 'Sanitary Ware — WC Suite Set',
    sku: 'SAN-WC-SUITE',
    fromLocation: { type: 'BRANCH', id: '3', name: 'Port Harcourt Store' },
    toLocation: { type: 'CUSTOMER', id: 'cust-8', name: 'Garden City Luxury Homes' },
    quantity: 12,
    movementType: MovementType.SALE,
    status: MovementStatus.COMPLETED,
    cost: 2400000,
    sellingPrice: 3120000,
    batchNumber: 'BAT-2026-06',
    expiryDate: new Date(Date.now() + 1813 * 24 * 3600000),
    notes: 'INV-10081 — Garden City Luxury Homes show units',
    createdBy: 'usr-4',
    createdByName: 'Mary Okoye',
    approvedBy: 'usr-4',
    approvedByName: 'Mary Okoye',
    createdAt: new Date(Date.now() - 18 * 86400000),
    approvedAt: new Date(Date.now() - 18 * 86400000 + 2 * 3600000),
    completedAt: new Date(Date.now() - 18 * 86400000 + 6 * 3600000)
  }
];

const MOCK_TOP_PRODUCTS: ProductPerformance[] = [
  {
    productId: '1',
    productName: 'Cement Dangote Grade 42.5R',
    sku: 'CEM-DG-425',
    category: 'Building Materials',
    totalSold: 12500,
    totalRevenue: 87500000,
    totalProfit: 12500000,
    averagePrice: 7000,
    sellThroughRate: 88,
    stockTurnover: 6.5,
    daysOfInventory: 15,
    performanceScore: 94,
    trend: 'UP',
    period: { start: new Date(), end: new Date() }
  },
  {
    productId: '2',
    productName: 'Iron Rod 16mm (Per Ton)',
    sku: 'IRN-16MM-TON',
    category: 'Metal & Steel',
    totalSold: 180,
    totalRevenue: 63000000,
    totalProfit: 9000000,
    averagePrice: 350000,
    sellThroughRate: 74,
    stockTurnover: 3.8,
    daysOfInventory: 24,
    performanceScore: 86,
    trend: 'UP',
    period: { start: new Date(), end: new Date() }
  },
  {
    productId: '4',
    productName: 'PVC Pipes 4-inch (Length 6m)',
    sku: 'PVC-4IN-6M',
    category: 'Plumbing & Pipes',
    totalSold: 4200,
    totalRevenue: 29400000,
    totalProfit: 5880000,
    averagePrice: 7000,
    sellThroughRate: 91,
    stockTurnover: 8.2,
    daysOfInventory: 11,
    performanceScore: 89,
    trend: 'STABLE',
    period: { start: new Date(), end: new Date() }
  },
  {
    productId: '3',
    productName: 'Wall Paint White Satin 20L',
    sku: 'PNT-WS-20L',
    category: 'Paints & Finishes',
    totalSold: 950,
    totalRevenue: 22800000,
    totalProfit: 5700000,
    averagePrice: 24000,
    sellThroughRate: 68,
    stockTurnover: 2.9,
    daysOfInventory: 35,
    performanceScore: 78,
    trend: 'DOWN',
    period: { start: new Date(), end: new Date() }
  }
];

const MOCK_BRANCH_SUMMARIES: BranchStockSummary[] = [
  {
    branchId: '1',
    branchName: 'Lagos Main Warehouse',
    totalProducts: 850,
    totalStockValue: 120500000,
    totalStockUnits: 42000,
    lowStockCount: 4,
    outOfStockCount: 1,
    topSellingProducts: [
      { productId: '1', productName: 'Cement Dangote Grade 42.5R', quantity: 4800, revenue: 33600000 },
      { productId: '7', productName: 'Roofing Sheet Long Span (Per Meter)', quantity: 3200, revenue: 27200000 },
      { productId: '6', productName: 'Electrical Cable 1.5mm (100m Roll)', quantity: 2100, revenue: 15750000 },
      { productId: '2', productName: 'Iron Rod 16mm (Per Ton)', quantity: 85, revenue: 29750000 },
      { productId: '5', productName: 'Floor Tiles 60x60cm (Box)', quantity: 1200, revenue: 9000000 }
    ]
  },
  {
    branchId: '2',
    branchName: 'Abuja Distribution Hub',
    totalProducts: 620,
    totalStockValue: 72100000,
    totalStockUnits: 24500,
    lowStockCount: 6,
    outOfStockCount: 2,
    topSellingProducts: [
      { productId: '5', productName: 'Floor Tiles 60x60cm (Box)', quantity: 1800, revenue: 13500000 },
      { productId: '8', productName: 'Plywood Sheet 18mm (4x8ft)', quantity: 420, revenue: 12600000 },
      { productId: '1', productName: 'Cement Dangote Grade 42.5R', quantity: 2100, revenue: 14700000 },
      { productId: '3', productName: 'Wall Paint White Satin 20L', quantity: 650, revenue: 15600000 },
      { productId: '2', productName: 'Iron Rod 16mm (Per Ton)', quantity: 40, revenue: 14000000 }
    ]
  },
  {
    branchId: '3',
    branchName: 'Port Harcourt Store',
    totalProducts: 480,
    totalStockValue: 36200000,
    totalStockUnits: 12800,
    lowStockCount: 2,
    outOfStockCount: 0,
    topSellingProducts: [
      { productId: '4', productName: 'PVC Pipes 4-inch (Length 6m)', quantity: 2400, revenue: 16800000 },
      { productId: '9', productName: 'Sanitary Ware — WC Suite Set', quantity: 32, revenue: 8320000 },
      { productId: '3', productName: 'Wall Paint White Satin 20L', quantity: 520, revenue: 12480000 },
      { productId: '7', productName: 'Roofing Sheet Long Span (Per Meter)', quantity: 900, revenue: 7650000 },
      { productId: '6', productName: 'Electrical Cable 1.5mm (100m Roll)', quantity: 380, revenue: 2850000 }
    ]
  },
  {
    branchId: '4',
    branchName: 'Kano Outlet',
    totalProducts: 310,
    totalStockValue: 16200000,
    totalStockUnits: 5900,
    lowStockCount: 2,
    outOfStockCount: 0,
    topSellingProducts: [
      { productId: '1', productName: 'Cement Dangote Grade 42.5R', quantity: 1600, revenue: 11200000 },
      { productId: '7', productName: 'Roofing Sheet Long Span (Per Meter)', quantity: 700, revenue: 5950000 },
      { productId: '2', productName: 'Iron Rod 16mm (Per Ton)', quantity: 18, revenue: 6300000 },
      { productId: '4', productName: 'PVC Pipes 4-inch (Length 6m)', quantity: 800, revenue: 5600000 },
      { productId: '3', productName: 'Wall Paint White Satin 20L', quantity: 210, revenue: 5040000 }
    ]
  },
  {
    branchId: '5',
    branchName: 'Ibadan Regional Store',
    totalProducts: 390,
    totalStockValue: 28400000,
    totalStockUnits: 9800,
    lowStockCount: 3,
    outOfStockCount: 1,
    topSellingProducts: [
      { productId: '1', productName: 'Cement Dangote Grade 42.5R', quantity: 2200, revenue: 15400000 },
      { productId: '5', productName: 'Floor Tiles 60x60cm (Box)', quantity: 700, revenue: 5250000 },
      { productId: '6', productName: 'Electrical Cable 1.5mm (100m Roll)', quantity: 410, revenue: 3075000 },
      { productId: '8', productName: 'Plywood Sheet 18mm (4x8ft)', quantity: 180, revenue: 5400000 },
      { productId: '4', productName: 'PVC Pipes 4-inch (Length 6m)', quantity: 620, revenue: 4340000 }
    ]
  },
  {
    branchId: '6',
    branchName: 'Enugu Express Depot',
    totalProducts: 265,
    totalStockValue: 19100000,
    totalStockUnits: 7200,
    lowStockCount: 1,
    outOfStockCount: 0,
    topSellingProducts: [
      { productId: '1', productName: 'Cement Dangote Grade 42.5R', quantity: 1900, revenue: 13300000 },
      { productId: '3', productName: 'Wall Paint White Satin 20L', quantity: 310, revenue: 7440000 },
      { productId: '4', productName: 'PVC Pipes 4-inch (Length 6m)', quantity: 480, revenue: 3360000 },
      { productId: '7', productName: 'Roofing Sheet Long Span (Per Meter)', quantity: 550, revenue: 4675000 },
      { productId: '2', productName: 'Iron Rod 16mm (Per Ton)', quantity: 12, revenue: 4200000 }
    ]
  }
];

const MOCK_BRANCH_INVENTORY: BranchInventory[] = [
  // ── Lagos Main Warehouse (br-1) ─────────────────────────────
  { id: 1, branchId: '1', branchName: 'Lagos Main Warehouse', productId: '1', productName: 'Cement Dangote Grade 42.5R', sku: 'CEM-DG-425', quantity: 1200, reorderPoint: 300, reorderQuantity: 600, safetyStock: 150, sellingPrice: 7000, costPrice: 6000, lastUpdated: new Date(Date.now() - 1 * 86400000) },
  { id: 2, branchId: '1', branchName: 'Lagos Main Warehouse', productId: '2', productName: 'Iron Rod 16mm (Per Ton)', sku: 'IRN-16MM-TON', quantity: 85, reorderPoint: 50, reorderQuantity: 100, safetyStock: 20, sellingPrice: 350000, costPrice: 300000, lastUpdated: new Date(Date.now() - 2 * 86400000) },
  { id: 3, branchId: '1', branchName: 'Lagos Main Warehouse', productId: '3', productName: 'Wall Paint White Satin 20L', sku: 'PNT-WS-20L', quantity: 420, reorderPoint: 100, reorderQuantity: 200, safetyStock: 50, sellingPrice: 24000, costPrice: 18000, lastUpdated: new Date(Date.now() - 3 * 86400000) },
  { id: 4, branchId: '1', branchName: 'Lagos Main Warehouse', productId: '5', productName: 'Floor Tiles 60x60cm (Box)', sku: 'TIL-FLR-6060', quantity: 1800, reorderPoint: 400, reorderQuantity: 800, safetyStock: 200, sellingPrice: 7500, costPrice: 5000, lastUpdated: new Date(Date.now() - 1 * 86400000) },
  { id: 5, branchId: '1', branchName: 'Lagos Main Warehouse', productId: '6', productName: 'Electrical Cable 1.5mm (100m Roll)', sku: 'ELC-CBL-15-100', quantity: 640, reorderPoint: 150, reorderQuantity: 300, safetyStock: 60, sellingPrice: 15000, costPrice: 11000, lastUpdated: new Date(Date.now() - 1 * 86400000) },
  { id: 6, branchId: '1', branchName: 'Lagos Main Warehouse', productId: '7', productName: 'Roofing Sheet Long Span (Per Meter)', sku: 'ROF-LS-MTR', quantity: 4200, reorderPoint: 800, reorderQuantity: 1500, safetyStock: 400, sellingPrice: 8500, costPrice: 6000, lastUpdated: new Date(Date.now() - 2 * 86400000) },
  { id: 7, branchId: '1', branchName: 'Lagos Main Warehouse', productId: '4', productName: 'PVC Pipes 4-inch (Length 6m)', sku: 'PVC-4IN-6M', quantity: 2100, reorderPoint: 500, reorderQuantity: 1000, safetyStock: 200, sellingPrice: 7000, costPrice: 5000, lastUpdated: new Date(Date.now() - 3 * 86400000) },
  // ── Abuja Distribution Hub (br-2) ───────────────────────────
  { id: 8, branchId: '2', branchName: 'Abuja Distribution Hub', productId: '1', productName: 'Cement Dangote Grade 42.5R', sku: 'CEM-DG-425', quantity: 800, reorderPoint: 200, reorderQuantity: 400, safetyStock: 100, sellingPrice: 7200, costPrice: 6000, lastUpdated: new Date(Date.now() - 2 * 86400000) },
  { id: 9, branchId: '2', branchName: 'Abuja Distribution Hub', productId: '2', productName: 'Iron Rod 16mm (Per Ton)', sku: 'IRN-16MM-TON', quantity: 12, reorderPoint: 50, reorderQuantity: 80, safetyStock: 20, sellingPrice: 360000, costPrice: 300000, lastUpdated: new Date(Date.now() - 1 * 86400000) },
  { id: 10, branchId: '2', branchName: 'Abuja Distribution Hub', productId: '5', productName: 'Floor Tiles 60x60cm (Box)', sku: 'TIL-FLR-6060', quantity: 950, reorderPoint: 200, reorderQuantity: 500, safetyStock: 100, sellingPrice: 7800, costPrice: 5000, lastUpdated: new Date(Date.now() - 3 * 86400000) },
  { id: 11, branchId: '2', branchName: 'Abuja Distribution Hub', productId: '8', productName: 'Plywood Sheet 18mm (4x8ft)', sku: 'PLY-18MM-4X8', quantity: 380, reorderPoint: 80, reorderQuantity: 200, safetyStock: 40, sellingPrice: 30000, costPrice: 22000, lastUpdated: new Date(Date.now() - 2 * 86400000) },
  { id: 12, branchId: '2', branchName: 'Abuja Distribution Hub', productId: '3', productName: 'Wall Paint White Satin 20L', sku: 'PNT-WS-20L', quantity: 0, reorderPoint: 80, reorderQuantity: 200, safetyStock: 40, sellingPrice: 25000, costPrice: 18000, lastUpdated: new Date(Date.now() - 4 * 86400000) },
  { id: 13, branchId: '2', branchName: 'Abuja Distribution Hub', productId: '7', productName: 'Roofing Sheet Long Span (Per Meter)', sku: 'ROF-LS-MTR', quantity: 1100, reorderPoint: 300, reorderQuantity: 600, safetyStock: 150, sellingPrice: 8800, costPrice: 6000, lastUpdated: new Date(Date.now() - 2 * 86400000) },
  // ── Port Harcourt Store (br-3) ───────────────────────────────
  { id: 14, branchId: '3', branchName: 'Port Harcourt Store', productId: '4', productName: 'PVC Pipes 4-inch (Length 6m)', sku: 'PVC-4IN-6M', quantity: 1600, reorderPoint: 400, reorderQuantity: 800, safetyStock: 200, sellingPrice: 7200, costPrice: 5000, lastUpdated: new Date(Date.now() - 1 * 86400000) },
  { id: 15, branchId: '3', branchName: 'Port Harcourt Store', productId: '9', productName: 'Sanitary Ware — WC Suite Set', sku: 'SAN-WC-SUITE', quantity: 28, reorderPoint: 10, reorderQuantity: 20, safetyStock: 5, sellingPrice: 260000, costPrice: 200000, lastUpdated: new Date(Date.now() - 2 * 86400000) },
  { id: 16, branchId: '3', branchName: 'Port Harcourt Store', productId: '3', productName: 'Wall Paint White Satin 20L', sku: 'PNT-WS-20L', quantity: 85, reorderPoint: 100, reorderQuantity: 200, safetyStock: 50, sellingPrice: 24500, costPrice: 18000, lastUpdated: new Date(Date.now() - 3 * 86400000) },
  { id: 17, branchId: '3', branchName: 'Port Harcourt Store', productId: '7', productName: 'Roofing Sheet Long Span (Per Meter)', sku: 'ROF-LS-MTR', quantity: 700, reorderPoint: 200, reorderQuantity: 400, safetyStock: 100, sellingPrice: 8700, costPrice: 6000, lastUpdated: new Date(Date.now() - 1 * 86400000) },
  { id: 18, branchId: '3', branchName: 'Port Harcourt Store', productId: '1', productName: 'Cement Dangote Grade 42.5R', sku: 'CEM-DG-425', quantity: 550, reorderPoint: 150, reorderQuantity: 300, safetyStock: 80, sellingPrice: 7100, costPrice: 6000, lastUpdated: new Date(Date.now() - 2 * 86400000) },
  // ── Kano Outlet (br-4) ──────────────────────────────────────
  { id: 19, branchId: '4', branchName: 'Kano Outlet', productId: '1', productName: 'Cement Dangote Grade 42.5R', sku: 'CEM-DG-425', quantity: 600, reorderPoint: 150, reorderQuantity: 300, safetyStock: 80, sellingPrice: 7100, costPrice: 6000, lastUpdated: new Date(Date.now() - 2 * 86400000) },
  { id: 20, branchId: '4', branchName: 'Kano Outlet', productId: '7', productName: 'Roofing Sheet Long Span (Per Meter)', sku: 'ROF-LS-MTR', quantity: 1200, reorderPoint: 300, reorderQuantity: 600, safetyStock: 150, sellingPrice: 8600, costPrice: 6000, lastUpdated: new Date(Date.now() - 1 * 86400000) },
  { id: 21, branchId: '4', branchName: 'Kano Outlet', productId: '2', productName: 'Iron Rod 16mm (Per Ton)', sku: 'IRN-16MM-TON', quantity: 22, reorderPoint: 20, reorderQuantity: 40, safetyStock: 10, sellingPrice: 355000, costPrice: 300000, lastUpdated: new Date(Date.now() - 3 * 86400000) },
  { id: 22, branchId: '4', branchName: 'Kano Outlet', productId: '4', productName: 'PVC Pipes 4-inch (Length 6m)', sku: 'PVC-4IN-6M', quantity: 480, reorderPoint: 120, reorderQuantity: 250, safetyStock: 60, sellingPrice: 7300, costPrice: 5000, lastUpdated: new Date(Date.now() - 2 * 86400000) },
  { id: 23, branchId: '4', branchName: 'Kano Outlet', productId: '3', productName: 'Wall Paint White Satin 20L', sku: 'PNT-WS-20L', quantity: 140, reorderPoint: 60, reorderQuantity: 120, safetyStock: 30, sellingPrice: 24000, costPrice: 18000, lastUpdated: new Date(Date.now() - 4 * 86400000) },
  // ── Ibadan Regional Store (br-5) ────────────────────────────
  { id: 24, branchId: '5', branchName: 'Ibadan Regional Store', productId: '1', productName: 'Cement Dangote Grade 42.5R', sku: 'CEM-DG-425', quantity: 900, reorderPoint: 200, reorderQuantity: 400, safetyStock: 100, sellingPrice: 7050, costPrice: 6000, lastUpdated: new Date(Date.now() - 1 * 86400000) },
  { id: 25, branchId: '5', branchName: 'Ibadan Regional Store', productId: '5', productName: 'Floor Tiles 60x60cm (Box)', sku: 'TIL-FLR-6060', quantity: 620, reorderPoint: 150, reorderQuantity: 300, safetyStock: 70, sellingPrice: 7600, costPrice: 5000, lastUpdated: new Date(Date.now() - 2 * 86400000) },
  { id: 26, branchId: '5', branchName: 'Ibadan Regional Store', productId: '6', productName: 'Electrical Cable 1.5mm (100m Roll)', sku: 'ELC-CBL-15-100', quantity: 25, reorderPoint: 80, reorderQuantity: 150, safetyStock: 40, sellingPrice: 15500, costPrice: 11000, lastUpdated: new Date(Date.now() - 1 * 86400000) },
  { id: 27, branchId: '5', branchName: 'Ibadan Regional Store', productId: '8', productName: 'Plywood Sheet 18mm (4x8ft)', sku: 'PLY-18MM-4X8', quantity: 190, reorderPoint: 50, reorderQuantity: 120, safetyStock: 25, sellingPrice: 31000, costPrice: 22000, lastUpdated: new Date(Date.now() - 3 * 86400000) },
  { id: 28, branchId: '5', branchName: 'Ibadan Regional Store', productId: '4', productName: 'PVC Pipes 4-inch (Length 6m)', sku: 'PVC-4IN-6M', quantity: 0, reorderPoint: 100, reorderQuantity: 250, safetyStock: 50, sellingPrice: 7100, costPrice: 5000, lastUpdated: new Date(Date.now() - 5 * 86400000) },
  // ── Enugu Express Depot (br-6) ──────────────────────────────
  { id: 29, branchId: '6', branchName: 'Enugu Express Depot', productId: '1', productName: 'Cement Dangote Grade 42.5R', sku: 'CEM-DG-425', quantity: 750, reorderPoint: 180, reorderQuantity: 350, safetyStock: 90, sellingPrice: 7080, costPrice: 6000, lastUpdated: new Date(Date.now() - 2 * 86400000) },
  { id: 30, branchId: '6', branchName: 'Enugu Express Depot', productId: '3', productName: 'Wall Paint White Satin 20L', sku: 'PNT-WS-20L', quantity: 280, reorderPoint: 70, reorderQuantity: 140, safetyStock: 35, sellingPrice: 24200, costPrice: 18000, lastUpdated: new Date(Date.now() - 3 * 86400000) },
  { id: 31, branchId: '6', branchName: 'Enugu Express Depot', productId: '4', productName: 'PVC Pipes 4-inch (Length 6m)', sku: 'PVC-4IN-6M', quantity: 360, reorderPoint: 100, reorderQuantity: 200, safetyStock: 50, sellingPrice: 7050, costPrice: 5000, lastUpdated: new Date(Date.now() - 1 * 86400000) },
  { id: 32, branchId: '6', branchName: 'Enugu Express Depot', productId: '7', productName: 'Roofing Sheet Long Span (Per Meter)', sku: 'ROF-LS-MTR', quantity: 820, reorderPoint: 200, reorderQuantity: 400, safetyStock: 100, sellingPrice: 8550, costPrice: 6000, lastUpdated: new Date(Date.now() - 2 * 86400000) },
  { id: 33, branchId: '6', branchName: 'Enugu Express Depot', productId: '2', productName: 'Iron Rod 16mm (Per Ton)', sku: 'IRN-16MM-TON', quantity: 8, reorderPoint: 15, reorderQuantity: 30, safetyStock: 8, sellingPrice: 352000, costPrice: 300000, lastUpdated: new Date(Date.now() - 4 * 86400000) }
];

const MOCK_CATEGORIES: Category[] = [
  { id: 1, categoryId: 'cat-1', name: 'Building Materials', description: 'Cement, blocks, aggregates and general construction materials', createdAt: new Date('2023-01-15'), updatedAt: new Date('2023-01-15') },
  { id: 2, categoryId: 'cat-2', name: 'Metal & Steel', description: 'Iron rods, steel beams and metal fabrication stock', createdAt: new Date('2023-01-15'), updatedAt: new Date('2023-01-15') },
  { id: 3, categoryId: 'cat-3', name: 'Paints & Finishes', description: 'Paints, primers, varnishes and surface finishes', createdAt: new Date('2023-01-15'), updatedAt: new Date('2023-01-15') },
  { id: 4, categoryId: 'cat-4', name: 'Plumbing & Pipes', description: 'PVC pipes, fittings and plumbing accessories', createdAt: new Date('2023-01-15'), updatedAt: new Date('2023-01-15') },
  { id: 5, categoryId: 'cat-5', name: 'Tiles & Flooring', description: 'Floor and wall tiles, grout and flooring accessories', createdAt: new Date('2023-02-01'), updatedAt: new Date('2023-02-01') },
  { id: 6, categoryId: 'cat-6', name: 'Electrical', description: 'Cables, fittings and electrical fixtures', createdAt: new Date('2023-02-01'), updatedAt: new Date('2023-02-01') },
  { id: 7, categoryId: 'cat-7', name: 'Roofing', description: 'Roofing sheets, nails and roofing accessories', createdAt: new Date('2023-02-15'), updatedAt: new Date('2023-02-15') },
  { id: 8, categoryId: 'cat-8', name: 'Wood & Timber', description: 'Plywood, planks and timber products', createdAt: new Date('2023-03-01'), updatedAt: new Date('2023-03-01') },
  { id: 9, categoryId: 'cat-9', name: 'Sanitary Ware', description: 'WC suites, wash basins and bathroom fittings', createdAt: new Date('2023-03-01'), updatedAt: new Date('2023-03-01') },
  { id: 10, categoryId: 'cat-10', name: 'Hardware & Fasteners', description: 'Screws, nails, bolts and general hardware', createdAt: new Date('2023-04-10'), updatedAt: new Date('2023-04-10') }
];

const MOCK_MEASUREMENT_UNITS: MeasurementUnit[] = [
  { id: 1, unitId: 'unit-1', name: 'Each', code: 'EACH', description: 'Single individual unit', createdAt: new Date('2023-01-15'), updatedAt: new Date('2023-01-15') },
  { id: 2, unitId: 'unit-2', name: 'Box', code: 'BOX', description: 'Boxed unit of multiple pieces', createdAt: new Date('2023-01-15'), updatedAt: new Date('2023-01-15') },
  { id: 3, unitId: 'unit-3', name: 'Kilogram', code: 'KG', description: 'Weight measured in kilograms', createdAt: new Date('2023-01-15'), updatedAt: new Date('2023-01-15') },
  { id: 4, unitId: 'unit-4', name: 'Litre', code: 'LITER', description: 'Volume measured in litres', createdAt: new Date('2023-01-15'), updatedAt: new Date('2023-01-15') },
  { id: 5, unitId: 'unit-5', name: 'Metre', code: 'METER', description: 'Length measured in metres', createdAt: new Date('2023-01-15'), updatedAt: new Date('2023-01-15') },
  { id: 6, unitId: 'unit-6', name: 'Ton', code: 'TON', description: 'Weight measured in metric tons', createdAt: new Date('2023-02-01'), updatedAt: new Date('2023-02-01') },
  { id: 7, unitId: 'unit-7', name: 'Bag', code: 'BAG', description: 'Bagged unit (e.g. cement bags)', createdAt: new Date('2023-02-01'), updatedAt: new Date('2023-02-01') },
  { id: 8, unitId: 'unit-8', name: 'Roll', code: 'ROLL', description: 'Rolled unit (e.g. cable rolls)', createdAt: new Date('2023-02-15'), updatedAt: new Date('2023-02-15') },
  { id: 9, unitId: 'unit-9', name: 'Set', code: 'SET', description: 'Matched set of parts', createdAt: new Date('2023-03-01'), updatedAt: new Date('2023-03-01') }
];

const MOCK_SUPPLIERS: Supplier[] = [
  { id: 1, supplierId: 'sup-1', name: 'Dangote Cement Factory', email: 'sales@dangotecement.com', phone: '+234-1-448-0001', address: 'Ibese Plant, Ogun State, Nigeria', contactPerson: 'Ibrahim Sule', createdAt: new Date('2023-01-10'), updatedAt: new Date('2023-01-10') },
  { id: 2, supplierId: 'sup-2', name: 'Niger Delta Plastics Ltd', email: 'info@ndplastics.ng', phone: '+234-84-770-2201', address: 'Trans-Amadi Industrial Layout, Port Harcourt', contactPerson: 'Ngozi Amadi', createdAt: new Date('2023-01-20'), updatedAt: new Date('2023-01-20') },
  { id: 3, supplierId: 'sup-3', name: 'Coleman Cables Nigeria', email: 'orders@colemancables.com.ng', phone: '+234-1-271-3300', address: '19 Iyalla Street, Surulere, Lagos', contactPerson: 'David Ekpo', createdAt: new Date('2023-02-05'), updatedAt: new Date('2023-02-05') },
  { id: 4, supplierId: 'sup-4', name: 'Tropical Timber Mills', email: 'sales@tropicaltimber.ng', phone: '+234-9-670-4410', address: 'Kilometer 12, Kaduna Road, Abuja', contactPerson: 'Solomon Danjuma', createdAt: new Date('2023-02-18'), updatedAt: new Date('2023-02-18') },
  { id: 5, supplierId: 'sup-5', name: 'Porcelain Palace Lagos', email: 'contact@porcelainpalace.ng', phone: '+234-1-905-6612', address: '44 Ikorodu Road, Lagos', contactPerson: 'Funmi Adebayo', createdAt: new Date('2023-03-02'), updatedAt: new Date('2023-03-02') },
  { id: 6, supplierId: 'sup-6', name: 'Roca Sanitaryware Nigeria', email: 'ng.sales@roca.com', phone: '+234-1-462-7788', address: '3 Ozumba Mbadiwe Avenue, Victoria Island, Lagos', contactPerson: 'Patrick Nnamdi', createdAt: new Date('2023-03-15'), updatedAt: new Date('2023-03-15') },
  { id: 7, supplierId: 'sup-7', name: 'Delta Steel Company', email: 'procurement@deltasteel.ng', phone: '+234-56-610-3390', address: 'Ovwian-Aladja, Delta State, Nigeria', contactPerson: 'Efe Okonta', createdAt: new Date('2023-04-01'), updatedAt: new Date('2023-04-01') },
  { id: 8, supplierId: 'sup-8', name: 'Ace Hardware Supplies Nigeria', email: 'sales@acehardware.ng', phone: '+234-1-330-8845', address: '12 Nnamdi Azikiwe Street, Onitsha, Anambra', contactPerson: 'Chidi Eze', createdAt: new Date('2023-04-20'), updatedAt: new Date('2023-04-20') }
];

const MOCK_PRODUCTS: Product[] = [
  { id: 1, sku: 'CEM-DG-425', name: 'Cement Dangote Grade 42.5R', description: 'High-strength Portland-limestone cement, 50kg bag, ideal for all structural applications.', category: 'Building Materials', subCategory: 'Cement', brand: 'Dangote', unitOfMeasure: 'EACH', costPrice: 6000, sellingPrice: 7000, stockQuantity: 4800, weight: 50, dimensions: { length: 60, width: 40, height: 10 }, images: [], tags: ['cement', 'bestseller'], status: ProductStatus.ACTIVE, supplierIds: ['1'], createdAt: new Date('2023-01-15'), updatedAt: new Date('2026-08-01') },
  { id: 2, sku: 'IRN-16MM-TON', name: 'Iron Rod 16mm (Per Ton)', description: 'High-tensile deformed steel reinforcement bar, 16mm diameter, sold per metric ton.', category: 'Metal & Steel', subCategory: 'Rebar', brand: 'Delta Steel', unitOfMeasure: 'KG', costPrice: 300000, sellingPrice: 350000, stockQuantity: 127, weight: 1000, dimensions: { length: 1200, width: 1.6, height: 1.6 }, images: [], tags: ['steel', 'rebar'], status: ProductStatus.ACTIVE, supplierIds: ['7'], createdAt: new Date('2023-01-20'), updatedAt: new Date('2026-08-01') },
  { id: 3, sku: 'PNT-WS-20L', name: 'Wall Paint White Satin 20L', description: 'Premium washable satin-finish emulsion paint, 20-litre pail, interior and exterior use.', category: 'Paints & Finishes', subCategory: 'Emulsion', brand: 'Dulux', unitOfMeasure: 'LITER', costPrice: 18000, sellingPrice: 24000, stockQuantity: 925, weight: 22, dimensions: { length: 30, width: 30, height: 35 }, images: [], tags: ['paint', 'interior'], status: ProductStatus.ACTIVE, supplierIds: [], createdAt: new Date('2023-02-01'), updatedAt: new Date('2026-07-15') },
  { id: 4, sku: 'PVC-4IN-6M', name: 'PVC Pipes 4-inch (Length 6m)', description: 'Schedule-40 uPVC drainage pipe, 4-inch diameter, 6-metre length, solvent-weld ends.', category: 'Plumbing & Pipes', subCategory: 'Pipes', brand: 'Niger Delta Plastics', unitOfMeasure: 'EACH', costPrice: 5000, sellingPrice: 7000, stockQuantity: 4540, weight: 8, dimensions: { length: 600, width: 10, height: 10 }, images: [], tags: ['plumbing', 'pvc'], status: ProductStatus.ACTIVE, supplierIds: ['2'], createdAt: new Date('2023-02-10'), updatedAt: new Date('2026-07-20') },
  { id: 5, sku: 'TIL-FLR-6060', name: 'Floor Tiles 60x60cm (Box)', description: 'Polished porcelain floor tiles, 60x60cm, 4 pieces per box (1.44sqm coverage).', category: 'Tiles & Flooring', subCategory: 'Floor Tiles', brand: 'Porcelain Palace', unitOfMeasure: 'BOX', costPrice: 5000, sellingPrice: 7500, stockQuantity: 3370, weight: 32, dimensions: { length: 62, width: 62, height: 8 }, images: [], tags: ['tiles', 'flooring'], status: ProductStatus.ACTIVE, supplierIds: ['5'], createdAt: new Date('2023-02-20'), updatedAt: new Date('2026-06-30') },
  { id: 6, sku: 'ELC-CBL-15-100', name: 'Electrical Cable 1.5mm (100m Roll)', description: 'Single-core PVC-insulated copper wiring cable, 1.5mm², 100-metre roll.', category: 'Electrical', subCategory: 'Cables', brand: 'Coleman', unitOfMeasure: 'EACH', costPrice: 11000, sellingPrice: 15000, stockQuantity: 665, weight: 12, dimensions: { length: 40, width: 40, height: 15 }, images: [], tags: ['electrical', 'cable'], status: ProductStatus.ACTIVE, supplierIds: ['3'], createdAt: new Date('2023-03-01'), updatedAt: new Date('2026-05-20') },
  { id: 7, sku: 'ROF-LS-MTR', name: 'Roofing Sheet Long Span (Per Meter)', description: 'Pre-painted aluminium long-span roofing sheet, 0.45mm gauge, sold per linear metre.', category: 'Roofing', subCategory: 'Roofing Sheets', brand: 'Colorbond', unitOfMeasure: 'METER', costPrice: 6000, sellingPrice: 8500, stockQuantity: 8020, weight: 3.5, dimensions: { length: 100, width: 90, height: 1 }, images: [], tags: ['roofing', 'aluminium'], status: ProductStatus.ACTIVE, supplierIds: [], createdAt: new Date('2023-03-10'), updatedAt: new Date('2026-08-01') },
  { id: 8, sku: 'PLY-18MM-4X8', name: 'Plywood Sheet 18mm (4x8ft)', description: 'Marine-grade plywood sheet, 18mm thickness, 4ft x 8ft panel.', category: 'Wood & Timber', subCategory: 'Plywood', brand: 'Tropical Timber', unitOfMeasure: 'EACH', costPrice: 22000, sellingPrice: 30000, stockQuantity: 570, weight: 28, dimensions: { length: 244, width: 122, height: 1.8 }, images: [], tags: ['wood', 'plywood'], status: ProductStatus.ACTIVE, supplierIds: ['4'], createdAt: new Date('2023-03-20'), updatedAt: new Date('2026-07-01') },
  { id: 9, sku: 'SAN-WC-SUITE', name: 'Sanitary Ware — WC Suite Set', description: 'Close-coupled ceramic WC suite with cistern, seat and fittings included.', category: 'Sanitary Ware', subCategory: 'WC Suites', brand: 'Roca', unitOfMeasure: 'EACH', costPrice: 200000, sellingPrice: 260000, stockQuantity: 28, weight: 35, dimensions: { length: 70, width: 40, height: 75 }, images: [], tags: ['sanitary', 'bathroom'], status: ProductStatus.ACTIVE, supplierIds: ['6'], createdAt: new Date('2023-04-01'), updatedAt: new Date('2026-06-15') },
  { id: 10, sku: 'SAN-WB-SET', name: 'Ceramic Wash Basin Set', description: 'Pedestal-mounted ceramic wash basin with tap and waste fittings — currently out of stock.', category: 'Sanitary Ware', subCategory: 'Wash Basins', brand: 'Roca', unitOfMeasure: 'EACH', costPrice: 45000, sellingPrice: 60000, stockQuantity: 0, weight: 18, dimensions: { length: 55, width: 45, height: 85 }, images: [], tags: ['sanitary', 'basin'], status: ProductStatus.OUT_OF_STOCK, supplierIds: ['6'], createdAt: new Date('2023-05-05'), updatedAt: new Date('2026-08-10') },
  { id: 11, sku: 'HDW-SCR-200', name: 'Wood Screws Assorted Box (200pc)', description: 'Mixed-size zinc-plated wood screws, 200 pieces per box, for general carpentry.', category: 'Hardware & Fasteners', subCategory: 'Screws & Fasteners', brand: 'Ace Hardware', unitOfMeasure: 'BOX', costPrice: 3500, sellingPrice: 5000, stockQuantity: 340, weight: 2.5, dimensions: { length: 20, width: 15, height: 8 }, images: [], tags: ['hardware', 'fasteners'], status: ProductStatus.ACTIVE, supplierIds: ['8'], createdAt: new Date('2023-05-15'), updatedAt: new Date('2026-07-05') },
  { id: 12, sku: 'ELC-FAN-56W', name: 'Ceiling Fan 56-inch White', description: 'Three-blade ceiling fan with light kit, 56-inch sweep, remote control included.', category: 'Electrical', subCategory: 'Fans & Lighting', brand: 'Binatone', unitOfMeasure: 'EACH', costPrice: 18000, sellingPrice: 25000, stockQuantity: 210, weight: 6, dimensions: { length: 142, width: 142, height: 40 }, images: [], tags: ['electrical', 'fan'], status: ProductStatus.ACTIVE, supplierIds: ['3'], createdAt: new Date('2023-06-01'), updatedAt: new Date('2026-06-20') },
  { id: 13, sku: 'ELC-WH-30L-OLD', name: 'Water Heater 30L (Old Model)', description: 'Discontinued 30-litre electric storage water heater, replaced by newer energy-efficient model.', category: 'Electrical', subCategory: 'Water Heaters', brand: 'Binatone', unitOfMeasure: 'EACH', costPrice: 35000, sellingPrice: 48000, stockQuantity: 15, weight: 14, dimensions: { length: 45, width: 45, height: 60 }, images: [], tags: ['electrical', 'discontinued'], status: ProductStatus.DISCONTINUED, supplierIds: ['3'], createdAt: new Date('2022-11-10'), updatedAt: new Date('2026-01-05') }
];

const MOCK_DASHBOARD_DATA: InventoryDashboardData = {
  stats: MOCK_STATS,
  alerts: MOCK_ALERTS,
  recentMovements: MOCK_MOVEMENTS,
  topProducts: MOCK_TOP_PRODUCTS,
  branchSummaries: MOCK_BRANCH_SUMMARIES,
  quickActions: []
};

// ============================================================
// INVENTORY SERVICE (LocalStorage implementation)
// ============================================================

@Injectable({
  providedIn: 'root'
})
export class InventoryService {

  private readonly baseUrl = environment.apiBaseUrl + '/x/api/v2/commerce';

  private get tenantId(): string {
    const h = window.location.hostname;
    return (h.includes('localhost') || h.includes('127.0.0.1')) ? 'optimax' : h.split('.')[0] || 'optimax';
  }

  // ----------------------------------------------------
  // STATE MANAGEMENT (RxJS subjects)
  // ----------------------------------------------------
  private dashboardDataSubject = new BehaviorSubject<InventoryDashboardData | null>(null);
  dashboardData$ = this.dashboardDataSubject.asObservable();

  private productsSubject = new BehaviorSubject<Product[]>([]);
  products$ = this.productsSubject.asObservable();

  private branchesSubject = new BehaviorSubject<Branch[]>([]);
  branches$ = this.branchesSubject.asObservable();

  private branchInventorySubject = new BehaviorSubject<BranchInventory[]>([]);
  branchInventory$ = this.branchInventorySubject.asObservable();

  private movementsSubject = new BehaviorSubject<StockMovement[]>([]);
  movements$ = this.movementsSubject.asObservable();

  private loadingSubject = new BehaviorSubject<boolean>(false);
  loading$ = this.loadingSubject.asObservable();

  private errorSubject = new BehaviorSubject<string | null>(null);
  error$ = this.errorSubject.asObservable();

  private currentBranchIdSubject = new BehaviorSubject<string | null>(null);
  currentBranchId$ = this.currentBranchIdSubject.asObservable();

  // ============================================================
  // HELPER METHOD FOR MOCK DATA
  // ============================================================

  private getMockRestockRequests(): RestockRequest[] {
    // Try to get from localStorage first
    const stored = localStorage.getItem('restock_requests');
    if (stored) {
      return JSON.parse(stored) as RestockRequest[];
    }

    // Generate mock data
    const mockRequests: RestockRequest[] = [
      {
        id: 1,
        productId: '1',
        productName: 'Cement Dangote Grade 42.5R',
        sku: 'CEM-DG-425',
        branchId: '2',
        branchName: 'Abuja Distribution Hub',
        currentStock: 0,
        reorderPoint: 80,
        safetyStock: 40,
        requestedQuantity: 200,
        approvedQuantity: 0,
        preferredSupplier: 'Dangote Cement Factory',
        costEstimate: 1400000,
        urgency: RestockUrgency.CRITICAL,
        status: RestockStatus.PENDING,
        notes: 'Completely out of stock at Abuja hub. Urgent restock needed.',
        createdBy: 'usr-3',
        createdByName: 'Emeka Obi',
        approvedBy: '',
        approvedByName: '',
        createdAt: new Date(Date.now() - 2 * 3600000),
        approvedAt: new Date(),
        purchaseOrderId: ''
      },
      {
        id: 2,
        productId: '2',
        productName: 'Iron Rod 16mm (Per Ton)',
        sku: 'IRN-16MM-TON',
        branchId: '5',
        branchName: 'Ibadan Regional Store',
        currentStock: 8,
        reorderPoint: 15,
        safetyStock: 8,
        requestedQuantity: 30,
        approvedQuantity: 0,
        preferredSupplier: 'Delta Steel Company',
        costEstimate: 10500000,
        urgency: RestockUrgency.CRITICAL,
        status: RestockStatus.PENDING,
        notes: 'Stock below safety threshold. Need immediate replenishment.',
        createdBy: 'usr-5',
        createdByName: 'Tunde Adeyemi',
        approvedBy: '',
        approvedByName: '',
        createdAt: new Date(Date.now() - 5 * 3600000),
        approvedAt: new Date(),
        purchaseOrderId: ''
      },
      {
        id: 3,
        productId: '3',
        productName: 'Wall Paint White Satin 20L',
        sku: 'PNT-WS-20L',
        branchId: '2',
        branchName: 'Abuja Distribution Hub',
        currentStock: 85,
        reorderPoint: 100,
        safetyStock: 50,
        requestedQuantity: 200,
        approvedQuantity: 0,
        preferredSupplier: '',
        costEstimate: 4800000,
        urgency: RestockUrgency.HIGH,
        status: RestockStatus.PENDING,
        notes: 'Stock falling below reorder point. Restock to maintain inventory levels.',
        createdBy: 'usr-3',
        createdByName: 'Emeka Obi',
        approvedBy: '',
        approvedByName: '',
        createdAt: new Date(Date.now() - 8 * 3600000),
        approvedAt: new Date(),
        purchaseOrderId: ''
      },
      {
        id: 4,
        productId: '4',
        productName: 'PVC Pipes 4-inch (Length 6m)',
        sku: 'PVC-4IN-6M',
        branchId: '6',
        branchName: 'Enugu Express Depot',
        currentStock: 360,
        reorderPoint: 100,
        safetyStock: 50,
        requestedQuantity: 200,
        approvedQuantity: 200,
        preferredSupplier: 'Niger Delta Plastics Ltd',
        costEstimate: 1000000,
        urgency: RestockUrgency.MEDIUM,
        status: RestockStatus.APPROVED,
        notes: 'Approved for standard restock.',
        createdBy: 'usr-6',
        createdByName: 'Chioma Nwosu',
        approvedBy: 'usr-2',
        approvedByName: 'Jane Smith',
        createdAt: new Date(Date.now() - 3 * 86400000),
        approvedAt: new Date(Date.now() - 2 * 86400000),
        purchaseOrderId: 'PO-9001'
      },
      {
        id: 5,
        productId: '7',
        productName: 'Roofing Sheet Long Span (Per Meter)',
        sku: 'ROF-LS-MTR',
        branchId: '4',
        branchName: 'Kano Outlet',
        currentStock: 1200,
        reorderPoint: 300,
        safetyStock: 150,
        requestedQuantity: 600,
        approvedQuantity: 600,
        preferredSupplier: '',
        costEstimate: 3600000,
        urgency: RestockUrgency.LOW,
        status: RestockStatus.ORDERED,
        notes: 'Scheduled restock ordered.',
        createdBy: 'usr-6',
        createdByName: 'Aisha Bello',
        approvedBy: 'usr-2',
        approvedByName: 'Jane Smith',
        createdAt: new Date(Date.now() - 5 * 86400000),
        approvedAt: new Date(Date.now() - 4 * 86400000),
        purchaseOrderId: 'PO-9002'
      },
      {
        id: 6,
        productId: '1',
        productName: 'Cement Dangote Grade 42.5R',
        sku: 'CEM-DG-425',
        branchId: '3',
        branchName: 'Port Harcourt Store',
        currentStock: 550,
        reorderPoint: 150,
        safetyStock: 80,
        requestedQuantity: 300,
        approvedQuantity: 0,
        preferredSupplier: 'Dangote Cement Factory',
        costEstimate: 2100000,
        urgency: RestockUrgency.MEDIUM,
        status: RestockStatus.PENDING,
        notes: 'Routine restock request.',
        createdBy: 'usr-4',
        createdByName: 'Mary Okoye',
        approvedBy: '',
        approvedByName: '',
        createdAt: new Date(Date.now() - 12 * 3600000),
        approvedAt: new Date(),
        purchaseOrderId: ''
      },
      {
        id: 7,
        productId: '5',
        productName: 'Floor Tiles 60x60cm (Box)',
        sku: 'TIL-FLR-6060',
        branchId: '2',
        branchName: 'Abuja Distribution Hub',
        currentStock: 950,
        reorderPoint: 200,
        safetyStock: 100,
        requestedQuantity: 400,
        approvedQuantity: 0,
        preferredSupplier: 'Porcelain Palace Lagos',
        costEstimate: 3000000,
        urgency: RestockUrgency.HIGH,
        status: RestockStatus.REJECTED,
        notes: 'Rejected due to budget constraints. Re-submit next quarter.',
        createdBy: 'usr-3',
        createdByName: 'Emeka Obi',
        approvedBy: 'usr-2',
        approvedByName: 'Jane Smith',
        createdAt: new Date(Date.now() - 7 * 86400000),
        approvedAt: new Date(Date.now() - 6 * 86400000),
        purchaseOrderId: ''
      },
      {
        id: 8,
        productId: '9',
        productName: 'Sanitary Ware — WC Suite Set',
        sku: 'SAN-WC-SUITE',
        branchId: '3',
        branchName: 'Port Harcourt Store',
        currentStock: 28,
        reorderPoint: 10,
        safetyStock: 5,
        requestedQuantity: 20,
        approvedQuantity: 20,
        preferredSupplier: 'Roca Sanitaryware Nigeria',
        costEstimate: 4000000,
        urgency: RestockUrgency.HIGH,
        status: RestockStatus.RECEIVED,
        notes: 'Stock received and verified.',
        createdBy: 'usr-4',
        createdByName: 'Mary Okoye',
        approvedBy: 'usr-2',
        approvedByName: 'Jane Smith',
        createdAt: new Date(Date.now() - 10 * 86400000),
        approvedAt: new Date(Date.now() - 9 * 86400000),
        purchaseOrderId: 'PO-9003'
      },
      {
        id: 9,
        productId: '6',
        productName: 'Electrical Cable 1.5mm (100m Roll)',
        sku: 'ELC-CBL-15-100',
        branchId: '5',
        branchName: 'Ibadan Regional Store',
        currentStock: 25,
        reorderPoint: 80,
        safetyStock: 40,
        requestedQuantity: 150,
        approvedQuantity: 0,
        preferredSupplier: 'Coleman Cables Nigeria',
        costEstimate: 1650000,
        urgency: RestockUrgency.CRITICAL,
        status: RestockStatus.PENDING,
        notes: 'Stock critically low. Immediate restock required.',
        createdBy: 'usr-5',
        createdByName: 'Tunde Adeyemi',
        approvedBy: '',
        approvedByName: '',
        createdAt: new Date(Date.now() - 3 * 3600000),
        approvedAt: new Date(),
        purchaseOrderId: ''
      },
      {
        id: 10,
        productId: '8',
        productName: 'Plywood Sheet 18mm (4x8ft)',
        sku: 'PLY-18MM-4X8',
        branchId: '1',
        branchName: 'Lagos Main Warehouse',
        currentStock: 570,
        reorderPoint: 100,
        safetyStock: 50,
        requestedQuantity: 200,
        approvedQuantity: 200,
        preferredSupplier: 'Tropical Timber Mills',
        costEstimate: 4400000,
        urgency: RestockUrgency.MEDIUM,
        status: RestockStatus.ORDERED,
        notes: 'PO issued to supplier.',
        createdBy: 'usr-1',
        createdByName: 'John Doe',
        approvedBy: 'usr-2',
        approvedByName: 'Jane Smith',
        createdAt: new Date(Date.now() - 4 * 86400000),
        approvedAt: new Date(Date.now() - 3 * 86400000),
        purchaseOrderId: 'PO-9004'
      }
    ];

    // Store in localStorage for persistence
    localStorage.setItem('restock_requests', JSON.stringify(mockRequests));
    return mockRequests;
  }

  // ----------------------------------------------------
  // CONSTRUCTOR – seed LocalStorage if empty
  // ----------------------------------------------------
  constructor(private http: HttpClient) {
    if (!localStorage.getItem(LOCAL_KEYS.DASHBOARD)) {
      // seed all keys with initial mock data
      localStorage.setItem(LOCAL_KEYS.DASHBOARD, JSON.stringify(MOCK_DASHBOARD_DATA));
      localStorage.setItem(LOCAL_KEYS.PRODUCTS, JSON.stringify(MOCK_PRODUCTS));
      localStorage.setItem(LOCAL_KEYS.BRANCHES, JSON.stringify(MOCK_BRANCHES));
      localStorage.setItem(LOCAL_KEYS.BRANCH_INVENTORY, JSON.stringify(MOCK_BRANCH_INVENTORY));
      localStorage.setItem(LOCAL_KEYS.MOVEMENTS, JSON.stringify(MOCK_MOVEMENTS));
      localStorage.setItem(LOCAL_KEYS.CATEGORIES, JSON.stringify(MOCK_CATEGORIES));
      localStorage.setItem(LOCAL_KEYS.MEASUREMENT_UNITS, JSON.stringify(MOCK_MEASUREMENT_UNITS));
      localStorage.setItem(LOCAL_KEYS.SUPPLIERS, JSON.stringify(MOCK_SUPPLIERS));
      localStorage.setItem(LOCAL_KEYS.BRANCH_TYPES, JSON.stringify(MOCK_BRANCH_TYPES));
      localStorage.setItem(LOCAL_KEYS.MOVEMENT_TYPES, JSON.stringify(MOCK_MOVEMENT_TYPES));
      localStorage.setItem(LOCAL_KEYS.LOCATION_TYPES, JSON.stringify(MOCK_LOCATION_TYPES));
      localStorage.setItem(LOCAL_KEYS.GENERIC_LOCATIONS, JSON.stringify(MOCK_GENERIC_LOCATIONS));
    } else {
      // Back-fill any keys that were previously seeded as empty arrays
      const existingBranches = JSON.parse(localStorage.getItem(LOCAL_KEYS.BRANCHES) as string) as Branch[];
      if (!existingBranches || existingBranches.length === 0) {
        localStorage.setItem(LOCAL_KEYS.BRANCHES, JSON.stringify(MOCK_BRANCHES));
      }
      const existingMovements = JSON.parse(localStorage.getItem(LOCAL_KEYS.MOVEMENTS) as string) as StockMovement[];
      if (!existingMovements || existingMovements.length === 0) {
        localStorage.setItem(LOCAL_KEYS.MOVEMENTS, JSON.stringify(MOCK_MOVEMENTS));
      }
      const existingInventory = JSON.parse(localStorage.getItem(LOCAL_KEYS.BRANCH_INVENTORY) as string) as BranchInventory[];
      if (!existingInventory || existingInventory.length === 0) {
        localStorage.setItem(LOCAL_KEYS.BRANCH_INVENTORY, JSON.stringify(MOCK_BRANCH_INVENTORY));
      }
      const existingProducts = JSON.parse(localStorage.getItem(LOCAL_KEYS.PRODUCTS) as string) as Product[];
      if (!existingProducts || existingProducts.length === 0) {
        localStorage.setItem(LOCAL_KEYS.PRODUCTS, JSON.stringify(MOCK_PRODUCTS));
      }
      const existingCategories = JSON.parse(localStorage.getItem(LOCAL_KEYS.CATEGORIES) as string) as Category[];
      if (!existingCategories || existingCategories.length === 0) {
        localStorage.setItem(LOCAL_KEYS.CATEGORIES, JSON.stringify(MOCK_CATEGORIES));
      }
      const existingUnits = JSON.parse(localStorage.getItem(LOCAL_KEYS.MEASUREMENT_UNITS) as string) as MeasurementUnit[];
      if (!existingUnits || existingUnits.length === 0) {
        localStorage.setItem(LOCAL_KEYS.MEASUREMENT_UNITS, JSON.stringify(MOCK_MEASUREMENT_UNITS));
      }
      const existingSuppliers = JSON.parse(localStorage.getItem(LOCAL_KEYS.SUPPLIERS) as string) as Supplier[];
      if (!existingSuppliers || existingSuppliers.length === 0) {
        localStorage.setItem(LOCAL_KEYS.SUPPLIERS, JSON.stringify(MOCK_SUPPLIERS));
      }
      const existingBranchTypes = JSON.parse(localStorage.getItem(LOCAL_KEYS.BRANCH_TYPES) as string) as string[];
      if (!existingBranchTypes || existingBranchTypes.length === 0) {
        localStorage.setItem(LOCAL_KEYS.BRANCH_TYPES, JSON.stringify(MOCK_BRANCH_TYPES));
      }
      const existingMovementTypes = JSON.parse(localStorage.getItem(LOCAL_KEYS.MOVEMENT_TYPES) as string) as string[];
      if (!existingMovementTypes || existingMovementTypes.length === 0) {
        localStorage.setItem(LOCAL_KEYS.MOVEMENT_TYPES, JSON.stringify(MOCK_MOVEMENT_TYPES));
      }
      const existingLocationTypes = JSON.parse(localStorage.getItem(LOCAL_KEYS.LOCATION_TYPES) as string) as string[];
      if (!existingLocationTypes || existingLocationTypes.length === 0) {
        localStorage.setItem(LOCAL_KEYS.LOCATION_TYPES, JSON.stringify(MOCK_LOCATION_TYPES));
      }
      // Merge in any mock locations missing by id (not just backfill when fully empty) — so
      // browsers that already seeded the old, sparser location list still pick up new ones.
      const existingGenericLocations = JSON.parse(localStorage.getItem(LOCAL_KEYS.GENERIC_LOCATIONS) as string) as any[];
      if (!existingGenericLocations || existingGenericLocations.length === 0) {
        localStorage.setItem(LOCAL_KEYS.GENERIC_LOCATIONS, JSON.stringify(MOCK_GENERIC_LOCATIONS));
      } else {
        const existingIds = new Set(existingGenericLocations.map(l => l.id));
        const missing = MOCK_GENERIC_LOCATIONS.filter(l => !existingIds.has(l.id));
        if (missing.length > 0) {
          localStorage.setItem(LOCAL_KEYS.GENERIC_LOCATIONS, JSON.stringify([...existingGenericLocations, ...missing]));
        }
      }
      // Refresh dashboard branch summaries with richer data
      const dash = JSON.parse(localStorage.getItem(LOCAL_KEYS.DASHBOARD) as string) as InventoryDashboardData;
      dash.branchSummaries = MOCK_BRANCH_SUMMARIES;
      dash.recentMovements = MOCK_MOVEMENTS.slice(0, 5);
      localStorage.setItem(LOCAL_KEYS.DASHBOARD, JSON.stringify(dash));
    }
    this.loadInitialState();
  }

  private loadInitialState(): void {
    this.dashboardDataSubject.next(
      JSON.parse(localStorage.getItem(LOCAL_KEYS.DASHBOARD) as string) as InventoryDashboardData
    );
    this.productsSubject.next(
      JSON.parse(localStorage.getItem(LOCAL_KEYS.PRODUCTS) as string) as Product[]
    );
    this.branchesSubject.next(
      JSON.parse(localStorage.getItem(LOCAL_KEYS.BRANCHES) as string) as Branch[]
    );
    // Removed erroneous self-referential call; quick actions are accessed via component subscription.


    this.branchInventorySubject.next(
      JSON.parse(localStorage.getItem(LOCAL_KEYS.BRANCH_INVENTORY) as string) as BranchInventory[]
    );
    this.movementsSubject.next(
      JSON.parse(localStorage.getItem(LOCAL_KEYS.MOVEMENTS) as string) as StockMovement[]
    );
  }

  // ----------------------------------------------------
  // DASHBOARD
  // ----------------------------------------------------
  /** Get full dashboard data */
  /**
   * Resolves a from/toLocation id (that's what's actually sent on the wire now — see
   * stockMovementToApiPayload()) back into a {type,id,name} object, using whatever
   * branches/suppliers we already have cached locally (populated by getBranches()/
   * getSuppliers(), which most screens that show movements call anyway). If the id doesn't
   * match either — a WAREHOUSE or CUSTOMER location, which this app has never had a real
   * lookup table for — it falls back to showing the raw id as the name too. Either way `id`
   * itself is always exactly what the backend sent, never guessed, which is what
   * applyTransferStockAdjustment() actually depends on for correct stock math.
   */
  private resolveMovementLocation(rawId: string, fallbackType: 'WAREHOUSE' | 'BRANCH' | 'SUPPLIER' | 'CUSTOMER'): { type: any; id: string; name: string } {
    const branches = JSON.parse(localStorage.getItem(LOCAL_KEYS.BRANCHES) as string || '[]') as Branch[];
    const branchMatch = branches.find(b => String(b.id) === rawId);
    if (branchMatch) return { type: 'BRANCH', id: rawId, name: branchMatch.name };

    const suppliers = JSON.parse(localStorage.getItem(LOCAL_KEYS.SUPPLIERS) as string || '[]') as Supplier[];
    const supplierMatch = suppliers.find(s => String(s.id) === rawId);
    if (supplierMatch) return { type: 'SUPPLIER', id: rawId, name: supplierMatch.name };

    return { type: fallbackType, id: rawId, name: rawId };
  }

  /**
   * The /inventory/movements API carries flat `fromLocation`/`toLocation` strings and
   * `createdById`/`approvedById`, but the rest of this app (movement forms/detail/approval,
   * the transfer wizard, applyTransferStockAdjustment()) works off StockMovement.fromLocation/
   * toLocation {type,id,name} and createdBy/approvedBy. Translate at the boundary rather than
   * gut that model — same approach as Branch's location/contact, but here the wire value is the
   * real id (see stockMovementToApiPayload()), so resolveMovementLocation() can recover a real
   * name for branches/suppliers instead of just echoing the raw value back as both id and name.
   */
  private stockMovementFromApi(raw: any): StockMovement {
    return {
      ...raw,
      fromLocation: this.resolveMovementLocation(raw.fromLocation, 'WAREHOUSE'),
      toLocation: this.resolveMovementLocation(raw.toLocation, 'CUSTOMER'),
      createdBy: raw.createdById,
      approvedBy: raw.approvedById,
      expiryDate: new Date(raw.expiryDate),
      createdAt: new Date(raw.createdAt),
      approvedAt: raw.approvedAt ? new Date(raw.approvedAt) : raw.approvedAt,
      completedAt: raw.completedAt ? new Date(raw.completedAt) : raw.completedAt,
      updatedAt: raw.updatedAt ? new Date(raw.updatedAt) : raw.updatedAt,
      scheduledDate: raw.scheduledDate ? new Date(raw.scheduledDate) : raw.scheduledDate
    };
  }

  /**
   * Flattens a StockMovement for POST/PUT/PATCH. Sends `.id` (not `.name`) for from/toLocation —
   * the wire format is a single free-text string, so it can only ever carry one of the two.
   * Sending the id keeps this app's own stock math (applyTransferStockAdjustment()) and the
   * backend's correct, since a bare display name gives neither side anything to actually look
   * the location up by. The cost: anything that reads this field directly (a backend report, an
   * admin screen not going through resolveMovementLocation() above) sees an id/code, not a
   * friendly name, unless it does its own lookup. That's a real limitation of the contract only
   * fixable by the backend adding separate id/type fields — flag it to that team if a clean name
   * needs to show up somewhere this app doesn't control.
   */
  private stockMovementToApiPayload(m: Partial<StockMovement>) {
    return {
      productId: m.productId,
      productName: m.productName,
      sku: m.sku,
      fromLocation: m.fromLocation?.id || '',
      toLocation: m.toLocation?.id || '',
      quantity: m.quantity,
      movementType: m.movementType,
      status: m.status,
      cost: m.cost,
      sellingPrice: m.sellingPrice,
      batchNumber: m.batchNumber,
      expiryDate: m.expiryDate,
      notes: m.notes,
      createdById: m.createdBy,
      createdByName: m.createdByName,
      approvedById: m.approvedBy,
      approvedByName: m.approvedByName,
      scheduledDate: m.scheduledDate
    };
  }

  /**
   * GET /inventory/dashboard — falls back to the local mock/localStorage copy if the API is
   * unavailable. Note: the API response has no `topProducts` field, so that part of the
   * dashboard is merged in from the local copy regardless of whether the live call succeeds.
   */
  getDashboardData(): Observable<InventoryDashboardData> {
    this.loadingSubject.next(true);
    const cached = JSON.parse(localStorage.getItem(LOCAL_KEYS.DASHBOARD) as string || 'null') as InventoryDashboardData | null;

    return this.http.get<any>(`${this.baseUrl}/inventory/dashboard`, {
      params: new HttpParams().set('tenantId', this.tenantId)
    }).pipe(
      map(raw => ({
        stats: { ...raw.stats, lastUpdated: new Date(raw.stats.lastUpdated) },
        alerts: (raw.alerts || []).map((a: any) => ({
          ...a,
          createdAt: new Date(a.createdAt),
          resolvedAt: a.resolvedAt ? new Date(a.resolvedAt) : a.resolvedAt
        })),
        recentMovements: (raw.recentMovements || []).map((m: any) => this.stockMovementFromApi(m)),
        branchSummaries: raw.branchSummaries || [],
        quickActions: raw.quickActions || [],
        // Not part of this endpoint's response — carried over from whatever we already had.
        topProducts: cached?.topProducts || []
      } as InventoryDashboardData)),
      tap(data => {
        localStorage.setItem(LOCAL_KEYS.DASHBOARD, JSON.stringify(data));
        this.dashboardDataSubject.next(data);
        this.loadingSubject.next(false);
      }),
      catchError(() => {
        const data = cached as InventoryDashboardData;
        this.dashboardDataSubject.next(data);
        this.loadingSubject.next(false);
        return of(data);
      })
    );
  }

  /** GET /inventory/dashboard/stats — falls back to the local dashboard snapshot's stats. */
  getDashboardStats(): Observable<InventoryDashboardStats> {
    const dash = JSON.parse(localStorage.getItem(LOCAL_KEYS.DASHBOARD) as string || 'null') as InventoryDashboardData | null;

    return this.http.get<InventoryDashboardStats>(`${this.baseUrl}/inventory/dashboard/stats`, {
      params: new HttpParams().set('tenantId', this.tenantId)
    }).pipe(
      map(stats => ({ ...stats, lastUpdated: new Date(stats.lastUpdated) })),
      catchError(() => of(dash?.stats ?? MOCK_STATS))
    );
  }

  /** Get alerts */
  getDashboardAlerts(): Observable<StockAlert[]> {
    const dash = JSON.parse(localStorage.getItem(LOCAL_KEYS.DASHBOARD) as string) as InventoryDashboardData;
    return of(dash.alerts);
  }

  /** Recent movements (limit optional) */
  getRecentMovements(limit: number = 10): Observable<StockMovement[]> {
    const dash = JSON.parse(localStorage.getItem(LOCAL_KEYS.DASHBOARD) as string) as InventoryDashboardData;
    return of(dash.recentMovements.slice(0, limit));
  }

  /** Normalises a raw /inventory/dashboard/product-performance record onto ProductPerformance. */
  private mapProductPerformance(raw: any): ProductPerformance {
    return {
      ...raw,
      period: {
        start: new Date(raw.startDate ?? raw.period?.start),
        end: new Date(raw.endDate ?? raw.period?.end)
      }
    } as ProductPerformance;
  }

  /**
   * GET /inventory/dashboard/product-performance — falls back to the local dashboard
   * snapshot's topProducts if the API is unavailable.
   */
  getTopProducts(limit: number = 5): Observable<ProductPerformance[]> {
    const dash = JSON.parse(localStorage.getItem(LOCAL_KEYS.DASHBOARD) as string || 'null') as InventoryDashboardData | null;

    return this.http.get<any[]>(`${this.baseUrl}/inventory/dashboard/product-performance`, {
      params: new HttpParams().set('tenantId', this.tenantId)
    }).pipe(
      map(res => (Array.isArray(res) ? res : []).map(raw => this.mapProductPerformance(raw)).slice(0, limit)),
      catchError(() => of((dash?.topProducts ?? MOCK_TOP_PRODUCTS).slice(0, limit)))
    );
  }

  /** GET /inventory/dashboard/top-selling — falls back to a slimmed-down view of getTopProducts(). */
  getTopSellingProducts(limit: number = 5): Observable<TopSellingProduct[]> {
    return this.http.get<TopSellingProduct[]>(`${this.baseUrl}/inventory/dashboard/top-selling`, {
      params: new HttpParams().set('tenantId', this.tenantId)
    }).pipe(
      map(res => (Array.isArray(res) ? res : []).slice(0, limit)),
      catchError(() => this.getTopProducts(limit).pipe(
        map(products => products.map(p => ({
          productId: p.productId,
          productName: p.productName,
          quantitySold: p.totalSold,
          revenue: p.totalRevenue
        })))
      ))
    );
  }

  /**
   * Branch summaries — computed live from current branches + branch inventory, not the frozen
   * dashboard snapshot (which never reflected inventory added/changed after initial seed, so a
   * newly created branch or a newly added product never showed up here).
   */
  getBranchSummaries(): Observable<BranchStockSummary[]> {
    const branches = JSON.parse(localStorage.getItem(LOCAL_KEYS.BRANCHES) as string || '[]') as Branch[];
    const allInventory = JSON.parse(localStorage.getItem(LOCAL_KEYS.BRANCH_INVENTORY) as string || '[]') as BranchInventory[];
    const summaries = branches.map(branch =>
      this.computeBranchStockSummary(branch, allInventory.filter(i => i.branchId === String(branch.id)))
    );
    return of(summaries);
  }

  /** Shared calculation behind getBranchSummaries()/getBranchAnalytics() so both stay consistent. */
  private computeBranchStockSummary(branch: Branch, inventory: BranchInventory[]): BranchStockSummary {
    let totalStockValue = 0;
    let totalStockUnits = 0;
    let lowStockCount = 0;
    let outOfStockCount = 0;

    inventory.forEach(item => {
      totalStockUnits += item.quantity;
      totalStockValue += item.quantity * (item.sellingPrice || 0);
      if (item.quantity <= 0) {
        outOfStockCount++;
      } else {
        const status = getStockStatus(item.quantity, item.reorderPoint, item.safetyStock);
        if (status === 'CRITICAL' || status === 'LOW') {
          lowStockCount++;
        }
      }
    });

    return {
      branchId: String(branch.id),
      branchName: branch.name,
      totalProducts: inventory.length,
      totalStockValue,
      totalStockUnits,
      lowStockCount,
      outOfStockCount
    };
  }

  // ----------------------------------------------------
  // STOCK ALERTS CRUD
  // ----------------------------------------------------

  /** GET /inventory/alerts — falls back to the dashboard snapshot's alerts if the API is unavailable. */
  getAlerts(): Observable<StockAlert[]> {
    return this.http.get<any[]>(`${this.baseUrl}/inventory/alerts`, {
      params: new HttpParams().set('tenantId', this.tenantId)
    }).pipe(
      map(res => (Array.isArray(res) ? res : []).map(a => ({
        ...a,
        createdAt: new Date(a.createdAt),
        resolvedAt: a.resolvedAt ? new Date(a.resolvedAt) : a.resolvedAt
      }))),
      catchError(() => {
        const dash = JSON.parse(localStorage.getItem(LOCAL_KEYS.DASHBOARD) as string || 'null') as InventoryDashboardData | null;
        return of(dash?.alerts || []);
      })
    );
  }

  /** GET /inventory/alerts/{id} */
  getAlertById(id: number): Observable<StockAlert> {
    return this.http.get<any>(`${this.baseUrl}/inventory/alerts/${id}`).pipe(
      map(a => ({ ...a, createdAt: new Date(a.createdAt), resolvedAt: a.resolvedAt ? new Date(a.resolvedAt) : a.resolvedAt }))
    );
  }

  /** POST /inventory/alerts — e.g. to manually raise an alert rather than wait for the system to detect it. */
  createAlert(alert: Partial<StockAlert>): Observable<StockAlert> {
    const payload = {
      type: alert.type,
      severity: alert.severity,
      productId: alert.productId,
      productName: alert.productName,
      sku: alert.sku,
      branchId: alert.branchId,
      branchName: alert.branchName,
      currentStock: alert.currentStock,
      threshold: alert.threshold,
      message: alert.message,
      isResolved: alert.isResolved ?? false
    };
    return this.http.post<any>(`${this.baseUrl}/inventory/alerts`, payload).pipe(
      map(a => ({ ...a, createdAt: new Date(a.createdAt), resolvedAt: a.resolvedAt ? new Date(a.resolvedAt) : a.resolvedAt }))
    );
  }

  /** DELETE /inventory/alerts/{id} */
  deleteAlert(id: string | number): Observable<void> {
    const numericId = Number(id);
    return this.http.delete<void>(`${this.baseUrl}/inventory/alerts/${numericId}`).pipe(
      tap(() => {
        const dash = JSON.parse(localStorage.getItem(LOCAL_KEYS.DASHBOARD) as string || 'null') as InventoryDashboardData | null;
        if (dash) {
          dash.alerts = dash.alerts.filter(a => a.id !== numericId);
          localStorage.setItem(LOCAL_KEYS.DASHBOARD, JSON.stringify(dash));
        }
      }),
      catchError(err => {
        console.error('[InventoryService] deleteAlert failed:', err);
        return of(void 0);
      })
    );
  }

  /**
   * PATCH /inventory/alerts/{id}/resolve — marks an alert resolved. Falls back to updating the
   * local dashboard snapshot if the API is unavailable.
   */
  resolveAlert(alertId: string | number): Observable<void> {
    const numericId = Number(alertId);
    return this.http.patch<any>(`${this.baseUrl}/inventory/alerts/${numericId}/resolve`, {}).pipe(
      map(() => undefined),
      tap(() => {
        const dash = JSON.parse(localStorage.getItem(LOCAL_KEYS.DASHBOARD) as string || 'null') as InventoryDashboardData | null;
        const alert = dash?.alerts.find(a => a.id === numericId);
        if (alert && dash) {
          alert.isResolved = true;
          alert.resolvedAt = new Date();
          localStorage.setItem(LOCAL_KEYS.DASHBOARD, JSON.stringify(dash));
        }
      }),
      catchError(err => {
        console.error('[InventoryService] resolveAlert failed, using local fallback:', err);
        const dash = JSON.parse(localStorage.getItem(LOCAL_KEYS.DASHBOARD) as string || 'null') as InventoryDashboardData | null;
        const alert = dash?.alerts.find(a => a.id === numericId);
        if (alert && dash) {
          alert.isResolved = true;
          alert.resolvedAt = new Date();
          localStorage.setItem(LOCAL_KEYS.DASHBOARD, JSON.stringify(dash));
        }
        return of(undefined);
      })
    );
  }

  // ----------------------------------------------------
  // PRODUCTS
  // ----------------------------------------------------

  /**
   * Reconstructs a Product's category/unitOfMeasure/supplierIds display fields from the wire's
   * categoryId/measurementUnitId/supplierId FKs, resolved against whatever Categories/
   * MeasurementUnits/Suppliers are already cached locally (all three are already connected).
   * subCategory/brand/weight/dimensions/tags/variants/images have no field in the /products API
   * at all — see the Product interface's own comments — so they're carried over from `existing`
   * (the same local record, if we already had one) rather than being blanked on every read.
   */
  private productFromApi(raw: any, existing?: Product): Product {
    // Compare FKs with String() coercion, not strict `===` — the API's categoryId/
    // measurementUnitId/supplierId can come back as a numeric string (e.g. "2") while the
    // cached Category/MeasurementUnit/Supplier records use a numeric `id`. A strict `===`
    // would silently fail to match, leaving `category` as '' and breaking the category
    // filter for every product (see resolveProductCategoryName below, which already does
    // this correctly for the same reason).
    const categories = JSON.parse(localStorage.getItem(LOCAL_KEYS.CATEGORIES) as string || '[]') as Category[];
    const category = categories.find(c => String(c.id) === String(raw.categoryId) || c.categoryId === raw.categoryId);

    const units = JSON.parse(localStorage.getItem(LOCAL_KEYS.MEASUREMENT_UNITS) as string || '[]') as MeasurementUnit[];
    const unit = units.find(u => String(u.id) === String(raw.measurementUnitId));
    const unitCode = unit?.code === 'PCS' ? 'EACH' : unit?.code;

    const suppliers = JSON.parse(localStorage.getItem(LOCAL_KEYS.SUPPLIERS) as string || '[]') as Supplier[];
    const supplier = suppliers.find(s => String(s.id) === String(raw.supplierId));

    return {
      id: raw.id,
      tenantId: raw.tenantId,
      productId: existing?.productId,
      sku: raw.sku,
      name: raw.name,
      description: raw.description,
      categoryId: raw.categoryId,
      category: category?.name || existing?.category || '',
      measurementUnitId: raw.measurementUnitId,
      unitOfMeasure: (unitCode as Product['unitOfMeasure']) || existing?.unitOfMeasure || 'EACH',
      costPrice: raw.costPrice,
      sellingPrice: raw.unitPrice,
      unitPrice: raw.unitPrice,
      price: raw.unitPrice,
      currency: raw.currency,
      taxRate: raw.taxRate,
      stockQuantity: raw.stockQuantity,
      status: raw.status,
      supplierId: raw.supplierId,
      supplierIds: supplier ? [String(supplier.id)] : (existing?.supplierIds || []),
      isComboProduct: raw.isComboProduct,
      createdAt: new Date(raw.createdAt),
      updatedAt: new Date(raw.updatedAt),
      // No wire field for any of these — carried over from the local record so a product's
      // local-only detail survives a refresh instead of being wiped by every API read.
      subCategory: existing?.subCategory || '',
      brand: existing?.brand || '',
      weight: existing?.weight ?? 0,
      dimensions: existing?.dimensions || { length: 0, width: 0, height: 0 },
      images: existing?.images || [],
      tags: existing?.tags || [],
      variants: existing?.variants
    };
  }

  /**
   * Flattens a Product for POST/PUT. subCategory/brand/weight/dimensions/tags/variants/images
   * have nowhere to go on the wire, so they're simply not sent — they stay exactly as they are
   * in the local copy regardless of what the API returns. categoryId/measurementUnitId/
   * supplierId are resolved from the display fields if not already set directly.
   */
  private productToApiPayload(p: Partial<Product>): any {
    const categories = JSON.parse(localStorage.getItem(LOCAL_KEYS.CATEGORIES) as string || '[]') as Category[];
    let categoryId = p.categoryId;
    if (categoryId == null && p.category) {
      const catName = typeof p.category === 'object' ? (p.category as Category).name : p.category;
      categoryId = categories.find(c => c.name === catName || c.categoryId === catName)?.id;
    }

    const units = JSON.parse(localStorage.getItem(LOCAL_KEYS.MEASUREMENT_UNITS) as string || '[]') as MeasurementUnit[];
    let measurementUnitId = p.measurementUnitId;
    if (measurementUnitId == null && p.unitOfMeasure) {
      const wantedCode = p.unitOfMeasure === 'EACH' ? 'PCS' : p.unitOfMeasure;
      measurementUnitId = units.find(u => u.code === wantedCode || u.unitId === p.unitOfMeasure)?.id;
    }

    // The API only supports one supplier — supplierIds (plural) is kept for the existing
    // multi-supplier UI, but only the first one round-trips through the real backend.
    let supplierId = p.supplierId;
    if (supplierId == null && p.supplierIds?.length) {
      supplierId = Number(p.supplierIds[0]);
    }

    return {
      tenantId: this.tenantId,
      name: p.name,
      sku: p.sku,
      description: p.description,
      unitPrice: p.unitPrice ?? p.sellingPrice ?? p.price ?? 0,
      costPrice: p.costPrice,
      currency: p.currency || 'NGN',
      stockQuantity: p.stockQuantity,
      categoryId,
      measurementUnitId,
      supplierId,
      taxRate: p.taxRate ?? 0,
      status: p.status,
      isComboProduct: p.isComboProduct ?? false
    };
  }

  /**
   * GET /products — falls back to the local mock/localStorage copy if the API is unavailable.
   *
   * Also fetches categories/units/suppliers alongside the products (rather than relying on
   * some other component having already called loadCategories()/loadUnits()/loadSuppliers()
   * first) — productFromApi() resolves each product's display fields against whatever's
   * currently in LOCAL_KEYS.CATEGORIES/MEASUREMENT_UNITS/SUPPLIERS, and callers that fetch
   * products without having loaded those first hit a race: if that localStorage cache is
   * still empty/stale when this runs, every product's `category` resolves to '', which
   * silently breaks the category filter (an empty string never matches a real category name).
   */
  getProducts(filters?: ProductFilters): Observable<PaginatedResponse<Product>> {
    this.loadingSubject.next(true);
    const cached = JSON.parse(localStorage.getItem(LOCAL_KEYS.PRODUCTS) as string || '[]') as Product[];
    const existingById = new Map(cached.map(p => [p.id, p]));

    return forkJoin({
      products: this.http.get<any[]>(`${this.baseUrl}/products`, {
        params: new HttpParams().set('tenantId', this.tenantId)
      }),
      categories: this.getCategories(),
      units: this.getMeasurementUnits(),
      suppliers: this.getSuppliers()
    }).pipe(
      map(({ products }) => (Array.isArray(products) ? products : []).map(raw => this.productFromApi(raw, existingById.get(raw.id)))),
      tap(products => localStorage.setItem(LOCAL_KEYS.PRODUCTS, JSON.stringify(products))),
      catchError(() => of(cached)),
      map(products => this.paginateProducts(products, filters)),
      tap(() => this.loadingSubject.next(false))
    );
  }

  /** Shared client-side filter/sort/paginate, used for both the live response and the fallback. */
  private paginateProducts(allProducts: Product[], filters?: ProductFilters): PaginatedResponse<Product> {
    let products = allProducts;

    if (filters) {
      // Status filter (ignore 'ALL')
      if (filters.status && filters.status !== 'ALL') {
        products = products.filter(p => p.status === filters.status);
      }
      // Category filter (ignore 'ALL')
      if (filters.category && filters.category !== 'ALL') {
        const categories = JSON.parse(localStorage.getItem(LOCAL_KEYS.CATEGORIES) as string || '[]') as Category[];
        products = products.filter(p =>
          this.resolveProductCategoryName(p, categories) === filters.category
        );
      }
      // Search term filter (supports both 'search' and 'searchTerm')
      const searchTerm = (filters.search ?? filters.searchTerm) as string | undefined;
      if (searchTerm) {
        const term = searchTerm.trim().toLowerCase();
        if (term) {
          products = products.filter(p =>
            (p.name && p.name.toLowerCase().includes(term)) ||
            (p.sku && p.sku.toLowerCase().includes(term))
          );
        }
      }
      // Price range filter (ignore unset/empty values so default '' from filter forms doesn't wipe results)
      if (filters.minPrice !== undefined && filters.minPrice !== null && (filters.minPrice as any) !== '') {
        const min = Number(filters.minPrice);
        products = products.filter(p => (p.unitPrice ?? p.sellingPrice ?? 0) >= min);
      }
      if (filters.maxPrice !== undefined && filters.maxPrice !== null && (filters.maxPrice as any) !== '') {
        const max = Number(filters.maxPrice);
        products = products.filter(p => (p.unitPrice ?? p.sellingPrice ?? 0) <= max);
      }
      // Restricts to a specific set of product ids — used to scope Product Management
      // down to just what's stocked at a Branch Manager's own branch.
      if (filters.productIds) {
        const idSet = new Set(filters.productIds.map(String));
        products = products.filter(p => idSet.has(String(p.id)));
      }
    }

    // Alphabetical order by name
    products = [...products].sort((a, b) => a.name.localeCompare(b.name));

    // Pagination
    const page = filters?.page ?? 0;
    const limit = filters?.limit ?? filters?.size ?? 10; // size used by component
    const start = page * limit;
    const pagedData = products.slice(start, start + limit);

    this.productsSubject.next(products);

    return {
      data: pagedData,
      total: products.length,
      page: page + 1,
      limit,
      totalPages: Math.ceil(products.length / limit) || 1
    };
  }

  /** GET /products/{id} — falls back to the local mock/localStorage copy if the API is unavailable. */
  getProduct(id: string | number): Observable<Product> {
    this.loadingSubject.next(true);
    const numericId = Number(id);
    const cached = JSON.parse(localStorage.getItem(LOCAL_KEYS.PRODUCTS) as string || '[]') as Product[];
    const existing = cached.find(p => p.id === numericId);

    return this.http.get<any>(`${this.baseUrl}/products/${numericId}`).pipe(
      map(raw => this.productFromApi(raw, existing)),
      tap(() => this.loadingSubject.next(false)),
      catchError(() => {
        this.loadingSubject.next(false);
        return existing ? of(existing) : throwError(() => new Error('Product not found'));
      })
    );
  }

  /**
   * Get performance data for a specific product. The real API only exposes performance as a
   * flat list (GET /inventory/dashboard/product-performance, no per-product endpoint), so this
   * fetches that list and filters client-side. Falls back to the local dashboard snapshot, and
   * finally to synthetic Math.random() numbers built from the product record if nothing else
   * has data for this product.
   */
  getProductPerformance(productId: string): Observable<ProductPerformance> {
    this.loadingSubject.next(true);

    return this.getTopProducts(1000).pipe(
      map(products => {
        const performance = products.find(p => p.productId === productId);
        if (!performance) {
          throw new Error('Product performance not found in list');
        }
        return performance;
      }),
      tap(() => this.loadingSubject.next(false)),
      catchError(() => {
        this.loadingSubject.next(false);

        const dash = JSON.parse(localStorage.getItem(LOCAL_KEYS.DASHBOARD) as string || 'null') as InventoryDashboardData | null;
        const cached = dash?.topProducts.find(p => p.productId === productId);
        if (cached) {
          return of(cached);
        }

        // Fallback: synthetic performance data built from the product record itself.
        // Generated once per product and cached — regenerating fresh Math.random()
        // numbers on every call made the analytics cards' values jump around every
        // time the user refreshed, even though nothing had actually changed.
        const fallbackCache = JSON.parse(
          localStorage.getItem(LOCAL_KEYS.PRODUCT_PERFORMANCE_FALLBACK) as string || '{}'
        ) as Record<string, ProductPerformance>;

        const cachedFallback = fallbackCache[productId];
        if (cachedFallback) {
          return of({
            ...cachedFallback,
            period: {
              start: new Date(cachedFallback.period.start),
              end: new Date(cachedFallback.period.end)
            }
          });
        }

        const products = JSON.parse(localStorage.getItem(LOCAL_KEYS.PRODUCTS) as string || '[]') as Product[];
        const product = products.find(p => String(p.id) === productId);
        if (!product) {
          return throwError(() => new Error('Product not found'));
        }

        const price = product.unitPrice ?? product.sellingPrice;
        const totalSold = Math.floor(50 + Math.random() * 500);
        const totalRevenue = totalSold * price;
        const totalProfit = totalSold * (price - product.costPrice);
        const fallback: ProductPerformance = {
          productId: String(product.id),
          productName: product.name,
          sku: product.sku,
          category: typeof product.category === 'string' ? product.category : product.category.name,
          totalSold,
          totalRevenue,
          totalProfit,
          averagePrice: price,
          sellThroughRate: Math.floor(40 + Math.random() * 50),
          stockTurnover: +(1 + Math.random() * 7).toFixed(1),
          daysOfInventory: Math.floor(10 + Math.random() * 40),
          performanceScore: Math.floor(40 + Math.random() * 50),
          trend: (['UP', 'DOWN', 'STABLE'] as const)[Math.floor(Math.random() * 3)],
          period: { start: new Date(), end: new Date() }
        };

        fallbackCache[productId] = fallback;
        try {
          localStorage.setItem(LOCAL_KEYS.PRODUCT_PERFORMANCE_FALLBACK, JSON.stringify(fallbackCache));
        } catch { /* storage limit reached — in-memory value is still returned below */ }

        return of(fallback);
      })
    );
  }

  /** POST /products — falls back to a local-only record if the API is unavailable. */
  createProduct(product: Partial<Product>): Observable<Product> {
    this.loadingSubject.next(true);
    const payload = this.productToApiPayload(product);

    return this.http.post<any>(`${this.baseUrl}/products`, payload).pipe(
      map(raw => this.productFromApi(raw, product as Product)),
      tap(newProduct => {
        const products = JSON.parse(localStorage.getItem(LOCAL_KEYS.PRODUCTS) as string || '[]') as Product[];
        products.push(newProduct);
        try {
          localStorage.setItem(LOCAL_KEYS.PRODUCTS, JSON.stringify(products));
        } catch { /* storage limit reached — in-memory state is still updated */ }
        this.productsSubject.next(products);
        this.loadingSubject.next(false);
      }),
      catchError(err => {
        console.error('[InventoryService] createProduct failed, using local fallback:', err);
        const products = JSON.parse(localStorage.getItem(LOCAL_KEYS.PRODUCTS) as string || '[]') as Product[];
        const newProduct: Product = {
          ...(product as Product),
          // Random suffix guards against id collisions when several products are created
          // back-to-back in the same millisecond (e.g. a bulk import loop).
          id: Date.now() + Math.floor(Math.random() * 1000),
          createdAt: new Date(),
          updatedAt: new Date()
        };
        products.push(newProduct);
        try {
          localStorage.setItem(LOCAL_KEYS.PRODUCTS, JSON.stringify(products));
        } catch {
          this.loadingSubject.next(false);
          return throwError(() => new Error('Failed to save product — storage limit reached. Try a smaller image.'));
        }
        this.productsSubject.next(products);
        this.loadingSubject.next(false);
        return of(newProduct);
      })
    );
  }

  /** PUT /products/{id} — falls back to updating the local copy if the API is unavailable. */
  updateProduct(id: string | number, product: Partial<Product>): Observable<Product> {
    this.loadingSubject.next(true);
    const numericId = Number(id);
    const products = JSON.parse(localStorage.getItem(LOCAL_KEYS.PRODUCTS) as string || '[]') as Product[];
    const index = products.findIndex(p => p.id === numericId);
    if (index === -1) {
      this.loadingSubject.next(false);
      return throwError(() => new Error('Product not found'));
    }
    const merged = { ...products[index], ...product } as Product;
    const payload = this.productToApiPayload(merged);

    return this.http.put<any>(`${this.baseUrl}/products/${numericId}`, payload).pipe(
      map(raw => this.productFromApi(raw, merged)),
      tap(updated => {
        products[index] = updated;
        try {
          localStorage.setItem(LOCAL_KEYS.PRODUCTS, JSON.stringify(products));
        } catch { /* storage limit reached — in-memory state is still updated */ }
        this.productsSubject.next(products);
        this.loadingSubject.next(false);
      }),
      catchError(err => {
        console.error('[InventoryService] updateProduct failed, using local fallback:', err);
        const fallback = { ...merged, updatedAt: new Date() };
        products[index] = fallback;
        try {
          localStorage.setItem(LOCAL_KEYS.PRODUCTS, JSON.stringify(products));
        } catch {
          this.loadingSubject.next(false);
          return throwError(() => new Error('Failed to save product — storage limit reached. Try a smaller image.'));
        }
        this.productsSubject.next(products);
        this.loadingSubject.next(false);
        return of(fallback);
      })
    );
  }

  /** DELETE /products/{id} — falls back to removing from the local copy if the API is unavailable. */
  deleteProduct(id: string | number): Observable<void> {
    this.loadingSubject.next(true);
    const numericId = Number(id);
    return this.http.delete<void>(`${this.baseUrl}/products/${numericId}`).pipe(
      tap(() => {
        const products = (JSON.parse(localStorage.getItem(LOCAL_KEYS.PRODUCTS) as string || '[]') as Product[])
          .filter(p => p.id !== numericId);
        localStorage.setItem(LOCAL_KEYS.PRODUCTS, JSON.stringify(products));
        this.productsSubject.next(products);
        this.loadingSubject.next(false);
      }),
      catchError(err => {
        console.error('[InventoryService] deleteProduct failed, using local fallback:', err);
        const products = (JSON.parse(localStorage.getItem(LOCAL_KEYS.PRODUCTS) as string || '[]') as Product[])
          .filter(p => p.id !== numericId);
        localStorage.setItem(LOCAL_KEYS.PRODUCTS, JSON.stringify(products));
        this.productsSubject.next(products);
        this.loadingSubject.next(false);
        return of(void 0);
      })
    );
  }

  /**
   * POST /products/{id}/images. NOTE: the given endpoints have no GET to list a product's
   * images — only this and deleteProductImage() below — so there's no way to reload a product's
   * image list from the server; this app keeps tracking Product.images as a local string[] and
   * updates it optimistically alongside this call.
   */
  addProductImage(productId: string | number, imageUrl: string, displayOrder: number = 0): Observable<ProductImage> {
    const numericId = Number(productId);
    const payload = { productId: numericId, imageUrl, displayOrder };

    return this.http.post<ProductImage>(`${this.baseUrl}/products/${numericId}/images`, payload).pipe(
      tap(() => {
        const products = JSON.parse(localStorage.getItem(LOCAL_KEYS.PRODUCTS) as string || '[]') as Product[];
        const product = products.find(p => p.id === numericId);
        if (product) {
          product.images = product.images?.includes(imageUrl)
            ? product.images
            : [...(product.images || []), imageUrl];
          localStorage.setItem(LOCAL_KEYS.PRODUCTS, JSON.stringify(products));
          this.productsSubject.next(products);
        }
      }),
      catchError(err => {
        console.error('[InventoryService] addProductImage failed:', err);
        return throwError(() => err);
      })
    );
  }

  /**
   * DELETE /products/images/{imageId}. `productId`/`imageUrl` are optional and only used to keep
   * the local Product.images list in sync — pass them when the caller has them (e.g. right after
   * addProductImage()'s response gave back the real imageId).
   */
  deleteProductImage(imageId: string | number, productId?: string | number, imageUrl?: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/products/images/${imageId}`).pipe(
      tap(() => {
        if (productId == null || !imageUrl) return;
        const numericId = Number(productId);
        const products = JSON.parse(localStorage.getItem(LOCAL_KEYS.PRODUCTS) as string || '[]') as Product[];
        const product = products.find(p => p.id === numericId);
        if (product) {
          product.images = (product.images || []).filter(u => u !== imageUrl);
          localStorage.setItem(LOCAL_KEYS.PRODUCTS, JSON.stringify(products));
          this.productsSubject.next(products);
        }
      }),
      catchError(err => {
        console.error('[InventoryService] deleteProductImage failed:', err);
        return throwError(() => err);
      })
    );
  }

  // ----------------------------------------------------
  // BRANCHES
  // ----------------------------------------------------
  // The /inventory/branches API only has flat `location: string` and
  // `contactEmployeeId: string` fields, but the rest of this app (the branch
  // form, branch detail page, branch-selector, branch-inventory filtering)
  // works off a richer Branch.location {address,city,state,country,postalCode,
  // lat,lng} / Branch.contact {manager,phone,email} shape. Rather than gut that
  // UI, we keep the rich shape as the app's model and translate at the API
  // boundary — branchToApiPayload() flattens it going out, branchFromApiResponse()
  // reconstructs it coming back. This is inherently lossy against a real backend:
  // phone/email and the individual address parts (city/state/country/postalCode/
  // lat/lng) have no wire representation, so a fresh GET from the real API can
  // only recover the manager name (via contactEmployeeId) and the address line
  // (via location) — the rest reverts to blank unless we still have a local copy
  // to merge with (which merge*() does whenever one's available).

  /** Flattens the rich Branch shape into the API's {location, contactEmployeeId} fields. */
  private branchToApiPayload(branch: Partial<Branch>) {
    const loc = branch.location;
    const location = loc
      ? [loc.address, loc.city, loc.state, loc.country, loc.postalCode].filter(Boolean).join(', ')
      : '';
    return {
      name: branch.name,
      code: branch.code,
      type: branch.type,
      location,
      contactEmployeeId: branch.contact?.manager || '',
      status: branch.status
    };
  }

  /**
   * Reconstructs the rich Branch shape from a flat API response. When `existing`
   * is passed (e.g. we already had this branch locally), its location/contact
   * detail is preserved instead of being blanked out by fields the wire format
   * doesn't carry.
   */
  private branchFromApiResponse(raw: any, existing?: Branch): Branch {
    return {
      id: raw.id,
      tenantId: raw.tenantId,
      name: raw.name,
      code: raw.code,
      type: raw.type,
      location: existing?.location ?? {
        address: raw.location || '',
        city: '',
        state: '',
        country: '',
        postalCode: '',
        lat: 0,
        lng: 0
      },
      contact: existing?.contact ?? {
        manager: raw.contactEmployeeId || '',
        phone: '',
        email: ''
      },
      status: raw.status,
      createdAt: new Date(raw.createdAt),
      updatedAt: new Date(raw.updatedAt)
    };
  }

  /** GET /inventory/branches — falls back to the local mock/localStorage copy if the API is unavailable. */
  getBranches(): Observable<Branch[]> {
    const cached = JSON.parse(localStorage.getItem(LOCAL_KEYS.BRANCHES) as string || '[]') as Branch[];

    return this.http.get<any[]>(`${this.baseUrl}/inventory/branches`, {
      params: new HttpParams().set('tenantId', this.tenantId)
    }).pipe(
      map(res => Array.isArray(res) ? res : []),
      map(rawBranches => rawBranches.map(raw => this.branchFromApiResponse(raw, cached.find(b => b.id === raw.id)))),
      tap(branches => {
        localStorage.setItem(LOCAL_KEYS.BRANCHES, JSON.stringify(branches));
        this.branchesSubject.next(branches);
      }),
      catchError(() => {
        this.branchesSubject.next(cached);
        return of(cached);
      })
    );
  }

  /** GET /inventory/branches/{id} — falls back to the local mock/localStorage copy if the API is unavailable. */
  getBranch(id: string | number): Observable<Branch> {
    const numericId = Number(id);
    const cached = JSON.parse(localStorage.getItem(LOCAL_KEYS.BRANCHES) as string || '[]') as Branch[];
    const existing = cached.find(b => b.id === numericId);

    return this.http.get<any>(`${this.baseUrl}/inventory/branches/${numericId}`).pipe(
      map(raw => this.branchFromApiResponse(raw, existing)),
      catchError(() => existing ? of(existing) : throwError(() => new Error('Branch not found')))
    );
  }

  /** PUT /inventory/branches/{id} — falls back to updating the local copy if the API is unavailable. */
  updateBranch(id: string | number, branch: Partial<Branch>): Observable<Branch> {
    const numericId = Number(id);
    const branches = JSON.parse(localStorage.getItem(LOCAL_KEYS.BRANCHES) as string || '[]') as Branch[];
    const index = branches.findIndex(b => b.id === numericId);
    if (index === -1) {
      return throwError(() => new Error('Branch not found'));
    }
    const merged = { ...branches[index], ...branch } as Branch;

    return this.http.put<any>(`${this.baseUrl}/inventory/branches/${numericId}`, this.branchToApiPayload(merged)).pipe(
      map(raw => this.branchFromApiResponse(raw, merged)),
      tap(updated => {
        branches[index] = updated;
        localStorage.setItem(LOCAL_KEYS.BRANCHES, JSON.stringify(branches));
        this.branchesSubject.next(branches);
      }),
      catchError(err => {
        console.error('[InventoryService] updateBranch failed, using local fallback:', err);
        const updated = { ...merged, updatedAt: new Date() };
        branches[index] = updated;
        localStorage.setItem(LOCAL_KEYS.BRANCHES, JSON.stringify(branches));
        this.branchesSubject.next(branches);
        return of(updated);
      })
    );
  }

  /** POST /inventory/branches — falls back to a local-only record if the API is unavailable. */
  createBranch(branch: Partial<Branch>): Observable<Branch> {
    const branches = JSON.parse(localStorage.getItem(LOCAL_KEYS.BRANCHES) as string || '[]') as Branch[];

    return this.http.post<any>(`${this.baseUrl}/inventory/branches`, this.branchToApiPayload(branch)).pipe(
      map(raw => this.branchFromApiResponse(raw, branch as Branch)),
      tap(newBranch => {
        branches.push(newBranch);
        localStorage.setItem(LOCAL_KEYS.BRANCHES, JSON.stringify(branches));
        this.branchesSubject.next(branches);
      }),
      catchError(err => {
        console.error('[InventoryService] createBranch failed, using local fallback:', err);
        const newBranch: Branch = {
          ...(branch as Branch),
          id: Date.now(),
          createdAt: new Date(),
          updatedAt: new Date()
        };
        branches.push(newBranch);
        localStorage.setItem(LOCAL_KEYS.BRANCHES, JSON.stringify(branches));
        this.branchesSubject.next(branches);
        return of(newBranch);
      })
    );
  }

  /** DELETE /inventory/branches/{id} — falls back to removing from the local copy if the API is unavailable. */
  deleteBranch(id: string | number): Observable<void> {
    const numericId = Number(id);
    return this.http.delete<void>(`${this.baseUrl}/inventory/branches/${numericId}`).pipe(
      tap(() => {
        const branches = (JSON.parse(localStorage.getItem(LOCAL_KEYS.BRANCHES) as string || '[]') as Branch[])
          .filter(b => b.id !== numericId);
        localStorage.setItem(LOCAL_KEYS.BRANCHES, JSON.stringify(branches));
        this.branchesSubject.next(branches);
      }),
      catchError(err => {
        console.error('[InventoryService] deleteBranch failed, using local fallback:', err);
        const branches = (JSON.parse(localStorage.getItem(LOCAL_KEYS.BRANCHES) as string || '[]') as Branch[])
          .filter(b => b.id !== numericId);
        localStorage.setItem(LOCAL_KEYS.BRANCHES, JSON.stringify(branches));
        this.branchesSubject.next(branches);
        return of(void 0);
      })
    );
  }

  /** Branch types (Standard/Flagship/Mini + any custom ones users have added). */
  getBranchTypes(): Observable<string[]> {
    const types = JSON.parse(localStorage.getItem(LOCAL_KEYS.BRANCH_TYPES) as string || '[]') as string[];
    return of(types);
  }

  /** Add a new custom branch type (no-op if it already exists, case-insensitively). */
  createBranchType(name: string): Observable<string[]> {
    const types = JSON.parse(localStorage.getItem(LOCAL_KEYS.BRANCH_TYPES) as string || '[]') as string[];
    const exists = types.some(t => t.toLowerCase() === name.toLowerCase());
    if (!exists) {
      types.push(name);
      localStorage.setItem(LOCAL_KEYS.BRANCH_TYPES, JSON.stringify(types));
    }
    return of(types);
  }

  /** Movement types (Purchase/Transfer/Sale/Return/Adjustment/Damaged + any custom ones). */
  getMovementTypes(): Observable<string[]> {
    const types = JSON.parse(localStorage.getItem(LOCAL_KEYS.MOVEMENT_TYPES) as string || '[]') as string[];
    return of(types);
  }

  /** Add a new custom movement type (no-op if it already exists, case-insensitively). */
  createMovementType(name: string): Observable<string[]> {
    const types = JSON.parse(localStorage.getItem(LOCAL_KEYS.MOVEMENT_TYPES) as string || '[]') as string[];
    const exists = types.some(t => t.toLowerCase() === name.toLowerCase());
    if (!exists) {
      types.push(name);
      localStorage.setItem(LOCAL_KEYS.MOVEMENT_TYPES, JSON.stringify(types));
    }
    return of(types);
  }

  /** Location types (Warehouse/Branch/Supplier/Customer + any custom ones). */
  getLocationTypes(): Observable<string[]> {
    const types = JSON.parse(localStorage.getItem(LOCAL_KEYS.LOCATION_TYPES) as string || '[]') as string[];
    return of(types);
  }

  /** Add a new custom location type (no-op if it already exists, case-insensitively). */
  createLocationType(name: string): Observable<string[]> {
    const types = JSON.parse(localStorage.getItem(LOCAL_KEYS.LOCATION_TYPES) as string || '[]') as string[];
    const exists = types.some(t => t.toLowerCase() === name.toLowerCase());
    if (!exists) {
      types.push(name);
      localStorage.setItem(LOCAL_KEYS.LOCATION_TYPES, JSON.stringify(types));
    }
    return of(types);
  }

  /**
   * Concrete locations (id + name) for a given location type, for the Movement form's "Location
   * ID" dropdown. 'BRANCH' and 'SUPPLIER' are backed by the real Branches/Suppliers collections
   * (mapped to a plain {id, name} shape); any other type — including custom ones a user adds —
   * is backed by a simple flat "generic locations" list, extensible the same way.
   */
  getLocationsByType(type: string): Observable<{ id: string; name: string }[]> {
    if (type === 'BRANCH') {
      const branches = JSON.parse(localStorage.getItem(LOCAL_KEYS.BRANCHES) as string || '[]') as Branch[];
      return of(branches.map(b => ({ id: String(b.id), name: b.name })));
    }
    if (type === 'SUPPLIER') {
      const suppliers = JSON.parse(localStorage.getItem(LOCAL_KEYS.SUPPLIERS) as string || '[]') as Supplier[];
      return of(suppliers.map(s => ({ id: String(s.id), name: s.name })));
    }
    const generic = JSON.parse(localStorage.getItem(LOCAL_KEYS.GENERIC_LOCATIONS) as string || '[]') as { id: string; type: string; name: string }[];
    return of(generic.filter(l => l.type === type).map(l => ({ id: l.id, name: l.name })));
  }

  /** Add a new named location under a given (non-BRANCH, non-SUPPLIER) location type. */
  createGenericLocation(type: string, name: string): Observable<{ id: string; name: string }[]> {
    const generic = JSON.parse(localStorage.getItem(LOCAL_KEYS.GENERIC_LOCATIONS) as string || '[]') as { id: string; type: string; name: string }[];
    const exists = generic.some(l => l.type === type && l.name.toLowerCase() === name.toLowerCase());
    if (!exists) {
      generic.push({ id: 'loc-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8), type, name });
      localStorage.setItem(LOCAL_KEYS.GENERIC_LOCATIONS, JSON.stringify(generic));
    }
    return of(generic.filter(l => l.type === type).map(l => ({ id: l.id, name: l.name })));
  }

  // getBranchInventory() is defined further down in this file (kept there rather than
  // duplicated here — this file is being edited concurrently and that's where the current
  // implementation lives; it already returns BranchInventory[] directly, not paginated).

  /**
   * Create or update a single branch inventory record (upsert by branchId + productId).
   * Calls POST /inventory/stock for a new record, or PUT /inventory/stock/{id} when one
   * already exists for this branch+product — falling back to the local mock/localStorage
   * copy if the API is unavailable.
   */
  saveBranchInventoryItem(data: {
    branchId: string;
    productId: string;
    quantity: number;
    reorderPoint: number;
    safetyStock: number;
    sellingPrice: number;
    costPrice?: number;
  }): Observable<BranchInventory> {
    this.loadingSubject.next(true);
    const allInventory = JSON.parse(localStorage.getItem(LOCAL_KEYS.BRANCH_INVENTORY) as string || '[]') as BranchInventory[];
    const branches = JSON.parse(localStorage.getItem(LOCAL_KEYS.BRANCHES) as string || '[]') as Branch[];
    const products = JSON.parse(localStorage.getItem(LOCAL_KEYS.PRODUCTS) as string || '[]') as Product[];

    const branch = branches.find(b => String(b.id) === data.branchId);
    const product = products.find(p => String(p.id) === data.productId);

    if (!product) {
      this.loadingSubject.next(false);
      return throwError(() => new Error('Product not found'));
    }

    const existingIndex = allInventory.findIndex(i => i.branchId === data.branchId && i.productId === data.productId);
    const existingRecord = existingIndex > -1 ? allInventory[existingIndex] : undefined;

    const payload = {
      branchId: data.branchId,
      branchName: branch?.name || '',
      productId: data.productId,
      productName: product.name,
      sku: product.sku,
      quantity: data.quantity,
      reorderPoint: data.reorderPoint,
      // This form only ever collects a single "reorder point" value — there's no separate
      // reorder-quantity input — so preserve whatever an existing record already had instead of
      // clobbering it every time stock is merely adjusted (e.g. by a transfer).
      reorderQuantity: existingRecord ? existingRecord.reorderQuantity : data.reorderPoint,
      safetyStock: data.safetyStock,
      sellingPrice: data.sellingPrice,
      costPrice: data.costPrice || 0
    };

    const persistLocally = (record: BranchInventory): BranchInventory => {
      if (existingIndex > -1) {
        allInventory[existingIndex] = record;
      } else {
        allInventory.push(record);
      }
      try {
        localStorage.setItem(LOCAL_KEYS.BRANCH_INVENTORY, JSON.stringify(allInventory));
      } catch { /* storage limit reached — keep going, in-memory state is still updated */ }
      this.branchInventorySubject.next(allInventory.filter(i => i.branchId === data.branchId));
      return record;
    };

    const request = existingRecord
      ? this.http.put<BranchInventory>(`${this.baseUrl}/inventory/stock/${existingRecord.id}`, payload)
      : this.http.post<BranchInventory>(`${this.baseUrl}/inventory/stock`, payload);

    return request.pipe(
      map(saved => persistLocally({ ...saved, lastUpdated: new Date() })),
      tap(() => this.loadingSubject.next(false)),
      catchError(err => {
        console.error('[InventoryService] saveBranchInventoryItem failed, using local fallback:', err);
        const record: BranchInventory = {
          id: existingRecord ? existingRecord.id : Date.now(),
          ...payload,
          lastUpdated: new Date()
        };
        persistLocally(record);
        this.loadingSubject.next(false);
        return of(record);
      })
    );
  }

  setCurrentBranch(branchId: string | null): void {
    this.currentBranchIdSubject.next(branchId);
  }

  getCurrentBranchId(): string | null {
    return this.currentBranchIdSubject.value;
  }

  // ----------------------------------------------------
  // STOCK MOVEMENTS
  // ----------------------------------------------------
  /** Get stock movements (filters applied) */
  /** GET /inventory/movements — falls back to the local mock/localStorage copy if the API is unavailable. */
  getMovements(filters?: MovementFilters): Observable<PaginatedResponse<StockMovement>> {
    this.loadingSubject.next(true);

    let params = new HttpParams().set('tenantId', this.tenantId);
    if (filters?.type) params = params.set('type', filters.type);
    if (filters?.status) params = params.set('status', filters.status);
    if (filters?.branchId) params = params.set('branchId', filters.branchId);
    if (filters?.productId) params = params.set('productId', filters.productId);

    return this.http.get<any[]>(`${this.baseUrl}/inventory/movements`, { params }).pipe(
      map(res => (Array.isArray(res) ? res : []).map(raw => this.stockMovementFromApi(raw))),
      tap(movements => localStorage.setItem(LOCAL_KEYS.MOVEMENTS, JSON.stringify(movements))),
      catchError(() => of(JSON.parse(localStorage.getItem(LOCAL_KEYS.MOVEMENTS) as string || '[]') as StockMovement[])),
      map(movements => this.paginateMovements(movements, filters)),
      tap(() => this.loadingSubject.next(false))
    );
  }

  /** Shared client-side filter/sort/paginate, used for both the live response and the fallback. */
  private paginateMovements(movements: StockMovement[], filters?: MovementFilters): PaginatedResponse<StockMovement> {
    let filtered = [...movements];

    if (filters?.type) {
      filtered = filtered.filter(m => m.movementType === filters.type);
    }
    if (filters?.status) {
      filtered = filtered.filter(m => m.status === filters.status);
    }
    // Search (product name or SKU) — applied before pagination, unlike a client-side filter
    // which could only ever search within one page.
    if (filters?.search) {
      const term = filters.search.trim().toLowerCase();
      if (term) {
        filtered = filtered.filter(m =>
          (m.productName && m.productName.toLowerCase().includes(term)) ||
          (m.sku && m.sku.toLowerCase().includes(term))
        );
      }
    }
    if (filters?.dateFrom) {
      const from = new Date(filters.dateFrom);
      filtered = filtered.filter(m => new Date(m.createdAt) >= from);
    }
    if (filters?.dateTo) {
      const to = new Date(filters.dateTo);
      filtered = filtered.filter(m => new Date(m.createdAt) <= to);
    }

    // Most recent first. Movements are appended to the end of storage as they're created, so
    // without this a newly created movement would only show up on a later page instead of
    // immediately at the top of the list.
    filtered = filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const page = filters?.page ?? 0;
    const limit = filters?.limit ?? filters?.size ?? 20;
    const total = filtered.length;
    const totalPages = Math.ceil(total / limit) || 1;
    const start = page * limit;
    const pagedData = filtered.slice(start, start + limit);

    this.movementsSubject.next(movements);

    return { data: pagedData, total, page, limit, totalPages };
  }

  /** POST /inventory/movements — falls back to a local-only record if the API is unavailable. */
  createMovement(movement: Partial<StockMovement>): Observable<StockMovement> {
    this.loadingSubject.next(true);
    const payload = this.stockMovementToApiPayload({ status: MovementStatus.PENDING, ...movement });

    return this.http.post<any>(`${this.baseUrl}/inventory/movements`, payload).pipe(
      map(raw => this.stockMovementFromApi(raw)),
      tap(newMovement => {
        const movements = JSON.parse(localStorage.getItem(LOCAL_KEYS.MOVEMENTS) as string || '[]') as StockMovement[];
        movements.push(newMovement);
        localStorage.setItem(LOCAL_KEYS.MOVEMENTS, JSON.stringify(movements));
        this.movementsSubject.next(movements);
        this.loadingSubject.next(false);
      }),
      catchError(err => {
        console.error('[InventoryService] createMovement failed, using local fallback:', err);
        const movements = JSON.parse(localStorage.getItem(LOCAL_KEYS.MOVEMENTS) as string || '[]') as StockMovement[];
        const newMovement: StockMovement = {
          ...(movement as StockMovement),
          id: Date.now(),
          createdAt: new Date(),
          status: MovementStatus.PENDING
        };
        movements.push(newMovement);
        localStorage.setItem(LOCAL_KEYS.MOVEMENTS, JSON.stringify(movements));
        this.movementsSubject.next(movements);
        this.loadingSubject.next(false);
        return of(newMovement);
      })
    );
  }

  /**
   * Update a movement. Status transitions (approve/reject/complete — anything setting `status`)
   * go through PATCH .../status, since that's the endpoint that actually accepts approvedBy/
   * approvedByName/completedAt; a plain field edit (product/quantity/locations/notes/etc. with
   * no status change) goes through PUT .../{id}. Falls back to updating the local copy if the
   * API is unavailable.
   */
  updateMovement(id: string | number, movement: Partial<StockMovement>): Observable<StockMovement> {
    this.loadingSubject.next(true);
    const numericId = Number(id);
    const movements = JSON.parse(localStorage.getItem(LOCAL_KEYS.MOVEMENTS) as string || '[]') as StockMovement[];
    const index = movements.findIndex(m => m.id === numericId);
    if (index === -1) {
      this.loadingSubject.next(false);
      return throwError(() => new Error('Movement not found'));
    }
    const previous = movements[index];
    const merged = { ...previous, ...movement } as StockMovement;
    const payload = this.stockMovementToApiPayload(merged);

    const request$ = movement.status
      ? this.http.patch<any>(`${this.baseUrl}/inventory/movements/${numericId}/status`, payload)
      : this.http.put<any>(`${this.baseUrl}/inventory/movements/${numericId}`, payload);

    return request$.pipe(
      map(raw => this.stockMovementFromApi(raw)),
      tap(updated => {
        this.finishMovementUpdate(movements, index, previous, updated);
        this.loadingSubject.next(false);
      }),
      catchError(err => {
        console.error('[InventoryService] updateMovement failed, using local fallback:', err);
        const fallback = { ...merged, updatedAt: new Date() };
        this.finishMovementUpdate(movements, index, previous, fallback);
        this.loadingSubject.next(false);
        return of(fallback);
      })
    );
  }

  /** Shared post-update bookkeeping: persist, broadcast, and run the transfer stock adjustment
   *  exactly once when a movement first reaches COMPLETED (see applyTransferStockAdjustment()'s
   *  own caveat about why this only reliably fires for movements created in this session). */
  private finishMovementUpdate(movements: StockMovement[], index: number, previous: StockMovement, updated: StockMovement): void {
    if (updated.status === MovementStatus.COMPLETED && previous.status !== MovementStatus.COMPLETED) {
      this.applyTransferStockAdjustment(updated);
      updated.completedAt = updated.completedAt || new Date();
    }
    movements[index] = updated;
    localStorage.setItem(LOCAL_KEYS.MOVEMENTS, JSON.stringify(movements));
    this.movementsSubject.next(movements);
  }

  /** Delete a movement. Only meant for PENDING movements (nothing has moved yet) — the calling
   *  component is responsible for that check, same as deleteProduct()'s convention. Falls back
   *  to removing from the local copy if the API is unavailable. */
  deleteMovement(id: string | number): Observable<void> {
    this.loadingSubject.next(true);
    const numericId = Number(id);
    return this.http.delete<void>(`${this.baseUrl}/inventory/movements/${numericId}`).pipe(
      tap(() => {
        const movements = (JSON.parse(localStorage.getItem(LOCAL_KEYS.MOVEMENTS) as string || '[]') as StockMovement[])
          .filter(m => m.id !== numericId);
        localStorage.setItem(LOCAL_KEYS.MOVEMENTS, JSON.stringify(movements));
        this.movementsSubject.next(movements);
        this.loadingSubject.next(false);
      }),
      catchError(err => {
        console.error('[InventoryService] deleteMovement failed, using local fallback:', err);
        const movements = (JSON.parse(localStorage.getItem(LOCAL_KEYS.MOVEMENTS) as string || '[]') as StockMovement[])
          .filter(m => m.id !== numericId);
        localStorage.setItem(LOCAL_KEYS.MOVEMENTS, JSON.stringify(movements));
        this.movementsSubject.next(movements);
        this.loadingSubject.next(false);
        return of(void 0);
      })
    );
  }

  /** Moves real stock for a branch-to-branch TRANSFER movement: decrements the source branch's
   *  inventory and increments the destination's. No-op for any other movement type/location
   *  shape. Called exactly once per movement, from whichever path completes it. */
  private applyTransferStockAdjustment(movement: StockMovement): void {
    if (movement.movementType !== MovementType.TRANSFER) return;
    if (movement.fromLocation?.type !== 'BRANCH' || movement.toLocation?.type !== 'BRANCH') return;

    const allInventory = JSON.parse(localStorage.getItem(LOCAL_KEYS.BRANCH_INVENTORY) as string || '[]') as BranchInventory[];
    const sourceItem = allInventory.find(i => i.branchId === movement.fromLocation.id && i.productId === movement.productId);
    if (!sourceItem || sourceItem.quantity < movement.quantity) {
      // Stock may have changed since the transfer was requested — skip rather than risk going
      // negative. The movement still gets marked completed/approved above; this is a data
      // inconsistency for someone to follow up on, not a reason to block the approval itself.
      return;
    }
    const destItem = allInventory.find(i => i.branchId === movement.toLocation.id && i.productId === movement.productId);

    this.saveBranchInventoryItem({
      branchId: movement.fromLocation.id,
      productId: movement.productId,
      quantity: sourceItem.quantity - movement.quantity,
      reorderPoint: sourceItem.reorderPoint,
      safetyStock: sourceItem.safetyStock,
      sellingPrice: sourceItem.sellingPrice,
      costPrice: sourceItem.costPrice
    }).subscribe();

    this.saveBranchInventoryItem({
      branchId: movement.toLocation.id,
      productId: movement.productId,
      quantity: (destItem?.quantity || 0) + movement.quantity,
      reorderPoint: destItem?.reorderPoint ?? sourceItem.reorderPoint,
      safetyStock: destItem?.safetyStock ?? sourceItem.safetyStock,
      sellingPrice: destItem?.sellingPrice ?? sourceItem.sellingPrice,
      costPrice: destItem?.costPrice ?? sourceItem.costPrice
    }).subscribe();
  }

  // ----------------------------------------------------
  // QUICK ACTIONS (read from dashboard data)
  // ----------------------------------------------------
  getQuickActions(): Observable<QuickAction[]> {
    const dash = JSON.parse(localStorage.getItem(LOCAL_KEYS.DASHBOARD) as string) as InventoryDashboardData;
    return of(dash.quickActions);
  }

  // ----------------------------------------------------
  // CATEGORIES CRUD
  // ----------------------------------------------------
  /** GET /categories — falls back to the local mock/localStorage copy if the API is unavailable. */
  getCategories(): Observable<Category[]> {
    return this.http.get<Category[]>(`${this.baseUrl}/categories`, {
      params: new HttpParams().set('tenantId', this.tenantId)
    }).pipe(
      map(res => Array.isArray(res) ? res : []),
      tap(categories => localStorage.setItem(LOCAL_KEYS.CATEGORIES, JSON.stringify(categories))),
      catchError(() => {
        const categories = JSON.parse(localStorage.getItem(LOCAL_KEYS.CATEGORIES) as string || '[]') as Category[];
        return of(categories);
      })
    );
  }

  /** POST /categories — falls back to a local-only record if the API is unavailable. */
  createCategory(cat: Partial<Category>): Observable<Category[]> {
    const payload = { name: cat.name, description: cat.description };

    return this.http.post<Category>(`${this.baseUrl}/categories`, payload).pipe(
      map(saved => {
        const categories = JSON.parse(localStorage.getItem(LOCAL_KEYS.CATEGORIES) as string || '[]') as Category[];
        categories.push(saved);
        localStorage.setItem(LOCAL_KEYS.CATEGORIES, JSON.stringify(categories));
        return categories;
      }),
      catchError(err => {
        console.error('[InventoryService] createCategory failed, using local fallback:', err);
        const categories = JSON.parse(localStorage.getItem(LOCAL_KEYS.CATEGORIES) as string || '[]') as Category[];
        const newCat: Category = { ...(cat as Category), id: Date.now(), createdAt: new Date(), updatedAt: new Date() };
        categories.push(newCat);
        localStorage.setItem(LOCAL_KEYS.CATEGORIES, JSON.stringify(categories));
        return of(categories);
      })
    );
  }

  /** PUT /categories/{id} — falls back to updating the local copy if the API is unavailable. */
  updateCategory(id: number, cat: Partial<Category>): Observable<Category[]> {
    const payload = { name: cat.name, description: cat.description };

    return this.http.put<Category>(`${this.baseUrl}/categories/${id}`, payload).pipe(
      map(saved => {
        const categories = JSON.parse(localStorage.getItem(LOCAL_KEYS.CATEGORIES) as string || '[]') as Category[];
        const idx = categories.findIndex(c => c.id === id);
        if (idx > -1) categories[idx] = saved; else categories.push(saved);
        localStorage.setItem(LOCAL_KEYS.CATEGORIES, JSON.stringify(categories));
        return categories;
      }),
      catchError(err => {
        console.error('[InventoryService] updateCategory failed, using local fallback:', err);
        const categories = JSON.parse(localStorage.getItem(LOCAL_KEYS.CATEGORIES) as string || '[]') as Category[];
        const idx = categories.findIndex(c => c.id === id);
        if (idx === -1) return throwError(() => new Error('Category not found'));
        categories[idx] = { ...categories[idx], ...cat, updatedAt: new Date() };
        localStorage.setItem(LOCAL_KEYS.CATEGORIES, JSON.stringify(categories));
        return of(categories);
      })
    );
  }

  /** DELETE /categories/{id} — falls back to removing from the local copy if the API is unavailable. */
  deleteCategory(id: number): Observable<Category[]> {
    return this.http.delete<void>(`${this.baseUrl}/categories/${id}`).pipe(
      map(() => {
        const categories = (JSON.parse(localStorage.getItem(LOCAL_KEYS.CATEGORIES) as string || '[]') as Category[])
          .filter(c => c.id !== id);
        localStorage.setItem(LOCAL_KEYS.CATEGORIES, JSON.stringify(categories));
        return categories;
      }),
      catchError(err => {
        console.error('[InventoryService] deleteCategory failed, using local fallback:', err);
        const categories = (JSON.parse(localStorage.getItem(LOCAL_KEYS.CATEGORIES) as string || '[]') as Category[])
          .filter(c => c.id !== id);
        localStorage.setItem(LOCAL_KEYS.CATEGORIES, JSON.stringify(categories));
        return of(categories);
      })
    );
  }

  // ----------------------------------------------------
  // INVENTORY NOTIFICATIONS (email/SMS/in-app alerts between branch managers and admins)
  // ----------------------------------------------------

  /** GET /inventory/notifications — send history, optionally filtered. */
  getInventoryNotifications(filters?: InventoryAlertFilters): Observable<InventoryNotification[]> {
    let params = new HttpParams().set('tenantId', this.tenantId);
    if (filters?.type) params = params.set('type', filters.type);
    if (filters?.channel) params = params.set('channel', filters.channel);
    if (filters?.status) params = params.set('status', filters.status);
    if (filters?.recipientRole) params = params.set('recipientRole', filters.recipientRole);
    if (filters?.branchId) params = params.set('branchId', filters.branchId);
    if (filters?.page) params = params.set('page', String(filters.page));
    if (filters?.limit) params = params.set('limit', String(filters.limit));

    return this.http.get<InventoryNotification[]>(`${this.baseUrl}/inventory/notifications`, { params }).pipe(
      map(res => Array.isArray(res) ? res : []),
      catchError(err => {
        console.error('[InventoryService] getInventoryNotifications failed:', err);
        return of([]);
      })
    );
  }

  /** GET /inventory/notifications/{id} — a single logged send (e.g. to check delivery status). */
  getInventoryNotificationById(id: number): Observable<InventoryNotification> {
    return this.http.get<InventoryNotification>(`${this.baseUrl}/inventory/notifications/${id}`);
  }

  /**
   * Triggers an email/SMS/in-app alert to admins/branch managers — e.g. a low-stock alert or a
   * transfer awaiting approval.
   * NOTE: the spec labels this endpoint as GET, but a GET request can't carry the trigger
   * payload (type/recipients/message/etc.) — this is almost certainly meant to be POST, which is
   * what's implemented here. Confirm with whoever owns this endpoint if POST turns out wrong.
   */
  triggerInventoryAlert(request: TriggerInventoryAlertRequest): Observable<InventoryNotification[]> {
    return this.http.post<InventoryNotification[]>(`${this.baseUrl}/inventory/notifications/trigger`, {
      ...request,
      tenantId: this.tenantId
    }).pipe(
      map(res => Array.isArray(res) ? res : []),
      catchError(err => {
        console.error('[InventoryService] triggerInventoryAlert failed:', err);
        return of([]);
      })
    );
  }

  // ----------------------------------------------------
  // MEASUREMENT UNITS CRUD
  // ----------------------------------------------------
  /** GET /measurement-units — falls back to the local mock/localStorage copy if the API is unavailable. */
  getMeasurementUnits(): Observable<MeasurementUnit[]> {
    return this.http.get<MeasurementUnit[]>(`${this.baseUrl}/measurement-units`, {
      params: new HttpParams().set('tenantId', this.tenantId)
    }).pipe(
      map(res => Array.isArray(res) ? res : []),
      tap(units => localStorage.setItem(LOCAL_KEYS.MEASUREMENT_UNITS, JSON.stringify(units))),
      catchError(() => {
        const units = JSON.parse(localStorage.getItem(LOCAL_KEYS.MEASUREMENT_UNITS) as string || '[]') as MeasurementUnit[];
        return of(units);
      })
    );
  }

  /** POST /measurement-units — falls back to a local-only record if the API is unavailable. */
  createMeasurementUnit(unit: Partial<MeasurementUnit>): Observable<MeasurementUnit[]> {
    const payload = { tenantId: this.tenantId, name: unit.name, code: unit.code, description: unit.description };

    return this.http.post<MeasurementUnit>(`${this.baseUrl}/measurement-units`, payload).pipe(
      map(saved => {
        const units = JSON.parse(localStorage.getItem(LOCAL_KEYS.MEASUREMENT_UNITS) as string || '[]') as MeasurementUnit[];
        units.push(saved);
        localStorage.setItem(LOCAL_KEYS.MEASUREMENT_UNITS, JSON.stringify(units));
        return units;
      }),
      catchError(err => {
        console.error('[InventoryService] createMeasurementUnit failed, using local fallback:', err);
        const units = JSON.parse(localStorage.getItem(LOCAL_KEYS.MEASUREMENT_UNITS) as string || '[]') as MeasurementUnit[];
        const newUnit: MeasurementUnit = { ...(unit as MeasurementUnit), id: Date.now() };
        units.push(newUnit);
        localStorage.setItem(LOCAL_KEYS.MEASUREMENT_UNITS, JSON.stringify(units));
        return of(units);
      })
    );
  }

  /** PUT /measurement-units/{id} — falls back to updating the local copy if the API is unavailable. */
  updateMeasurementUnit(id: string | number, unit: Partial<MeasurementUnit>): Observable<MeasurementUnit[]> {
    const numericId = Number(id);
    const payload = { tenantId: this.tenantId, name: unit.name, code: unit.code, description: unit.description };

    return this.http.put<MeasurementUnit>(`${this.baseUrl}/measurement-units/${numericId}`, payload).pipe(
      map(saved => {
        const units = JSON.parse(localStorage.getItem(LOCAL_KEYS.MEASUREMENT_UNITS) as string || '[]') as MeasurementUnit[];
        const idx = units.findIndex(u => u.id === numericId);
        if (idx > -1) units[idx] = saved; else units.push(saved);
        localStorage.setItem(LOCAL_KEYS.MEASUREMENT_UNITS, JSON.stringify(units));
        return units;
      }),
      catchError(err => {
        console.error('[InventoryService] updateMeasurementUnit failed, using local fallback:', err);
        const units = JSON.parse(localStorage.getItem(LOCAL_KEYS.MEASUREMENT_UNITS) as string || '[]') as MeasurementUnit[];
        const idx = units.findIndex(u => u.id === numericId);
        if (idx === -1) return throwError(() => new Error('Unit not found'));
        units[idx] = { ...units[idx], ...unit };
        localStorage.setItem(LOCAL_KEYS.MEASUREMENT_UNITS, JSON.stringify(units));
        return of(units);
      })
    );
  }

  /** DELETE /measurement-units/{id} — falls back to removing from the local copy if the API is unavailable. */
  deleteMeasurementUnit(id: string | number): Observable<MeasurementUnit[]> {
    const numericId = Number(id);
    return this.http.delete<void>(`${this.baseUrl}/measurement-units/${numericId}`).pipe(
      map(() => {
        const units = (JSON.parse(localStorage.getItem(LOCAL_KEYS.MEASUREMENT_UNITS) as string || '[]') as MeasurementUnit[])
          .filter(u => u.id !== numericId);
        localStorage.setItem(LOCAL_KEYS.MEASUREMENT_UNITS, JSON.stringify(units));
        return units;
      }),
      catchError(err => {
        console.error('[InventoryService] deleteMeasurementUnit failed, using local fallback:', err);
        const units = (JSON.parse(localStorage.getItem(LOCAL_KEYS.MEASUREMENT_UNITS) as string || '[]') as MeasurementUnit[])
          .filter(u => u.id !== numericId);
        localStorage.setItem(LOCAL_KEYS.MEASUREMENT_UNITS, JSON.stringify(units));
        return of(units);
      })
    );
  }

  // ----------------------------------------------------
  // SUPPLIERS CRUD
  // ----------------------------------------------------

  /** GET /suppliers — falls back to the local mock/localStorage copy if the API is unavailable. */
  getSuppliers(): Observable<Supplier[]> {
    return this.http.get<Supplier[]>(`${this.baseUrl}/suppliers`, {
      params: new HttpParams().set('tenantId', this.tenantId)
    }).pipe(
      map(res => Array.isArray(res) ? res : []),
      tap(suppliers => localStorage.setItem(LOCAL_KEYS.SUPPLIERS, JSON.stringify(suppliers))),
      catchError(() => {
        const suppliers = JSON.parse(localStorage.getItem(LOCAL_KEYS.SUPPLIERS) as string || '[]') as Supplier[];
        return of(suppliers);
      })
    );
  }

  /** POST /suppliers — falls back to a local-only record if the API is unavailable. */
  createSupplier(supplier: Partial<Supplier>): Observable<Supplier[]> {
    const payload = {
      tenantId: this.tenantId,
      name: supplier.name,
      email: supplier.email,
      phone: supplier.phone,
      address: supplier.address,
      contactPerson: supplier.contactPerson
    };

    return this.http.post<Supplier>(`${this.baseUrl}/suppliers`, payload).pipe(
      map(saved => {
        const suppliers = JSON.parse(localStorage.getItem(LOCAL_KEYS.SUPPLIERS) as string || '[]') as Supplier[];
        suppliers.push(saved);
        localStorage.setItem(LOCAL_KEYS.SUPPLIERS, JSON.stringify(suppliers));
        return suppliers;
      }),
      catchError(err => {
        console.error('[InventoryService] createSupplier failed, using local fallback:', err);
        const suppliers = JSON.parse(localStorage.getItem(LOCAL_KEYS.SUPPLIERS) as string || '[]') as Supplier[];
        const newSup: Supplier = { ...(supplier as Supplier), id: Date.now() };
        suppliers.push(newSup);
        localStorage.setItem(LOCAL_KEYS.SUPPLIERS, JSON.stringify(suppliers));
        return of(suppliers);
      })
    );
  }

  /** PUT /suppliers/{id} — falls back to updating the local copy if the API is unavailable. */
  updateSupplier(id: string | number, supplier: Partial<Supplier>): Observable<Supplier[]> {
    const numericId = Number(id);
    const payload = {
      tenantId: this.tenantId,
      name: supplier.name,
      email: supplier.email,
      phone: supplier.phone,
      address: supplier.address,
      contactPerson: supplier.contactPerson
    };

    return this.http.put<Supplier>(`${this.baseUrl}/suppliers/${numericId}`, payload).pipe(
      map(saved => {
        const suppliers = JSON.parse(localStorage.getItem(LOCAL_KEYS.SUPPLIERS) as string || '[]') as Supplier[];
        const idx = suppliers.findIndex(s => s.id === numericId);
        if (idx > -1) suppliers[idx] = saved; else suppliers.push(saved);
        localStorage.setItem(LOCAL_KEYS.SUPPLIERS, JSON.stringify(suppliers));
        return suppliers;
      }),
      catchError(err => {
        console.error('[InventoryService] updateSupplier failed, using local fallback:', err);
        const suppliers = JSON.parse(localStorage.getItem(LOCAL_KEYS.SUPPLIERS) as string || '[]') as Supplier[];
        const idx = suppliers.findIndex(s => s.id === numericId);
        if (idx === -1) return throwError(() => new Error('Supplier not found'));
        suppliers[idx] = { ...suppliers[idx], ...supplier };
        localStorage.setItem(LOCAL_KEYS.SUPPLIERS, JSON.stringify(suppliers));
        return of(suppliers);
      })
    );
  }

  /** DELETE /suppliers/{id} — falls back to removing from the local copy if the API is unavailable. */
  deleteSupplier(id: string | number): Observable<Supplier[]> {
    const numericId = Number(id);
    return this.http.delete<void>(`${this.baseUrl}/suppliers/${numericId}`).pipe(
      map(() => {
        const suppliers = (JSON.parse(localStorage.getItem(LOCAL_KEYS.SUPPLIERS) as string || '[]') as Supplier[])
          .filter(s => s.id !== numericId);
        localStorage.setItem(LOCAL_KEYS.SUPPLIERS, JSON.stringify(suppliers));
        return suppliers;
      }),
      catchError(err => {
        console.error('[InventoryService] deleteSupplier failed, using local fallback:', err);
        const suppliers = (JSON.parse(localStorage.getItem(LOCAL_KEYS.SUPPLIERS) as string || '[]') as Supplier[])
          .filter(s => s.id !== numericId);
        localStorage.setItem(LOCAL_KEYS.SUPPLIERS, JSON.stringify(suppliers));
        return of(suppliers);
      })
    );
  }

  // ----------------------------------------------------
  // SINGLE MOVEMENT FETCH
  // ----------------------------------------------------
  /** GET /inventory/movements/{id} — falls back to the local mock/localStorage copy if the API is unavailable. */
  getMovement(id: string | number): Observable<StockMovement> {
    const numericId = Number(id);
    return this.http.get<any>(`${this.baseUrl}/inventory/movements/${numericId}`).pipe(
      map(raw => this.stockMovementFromApi(raw)),
      catchError(() => {
        const movements = JSON.parse(localStorage.getItem(LOCAL_KEYS.MOVEMENTS) as string || '[]') as StockMovement[];
        const mov = movements.find(m => m.id === numericId);
        return mov ? of(mov) : throwError(() => new Error('Movement not found'));
      })
    );
  }

  // ----------------------------------------------------
  // BRANCH ANALYTICS
  // ----------------------------------------------------
  /** Live stock summary for a single branch — previously a stub that always returned `{}`,
   *  which is why Branch Detail's "Branch Summary" card and Analytics tab always showed blank. */
  getBranchAnalytics(branchId: string): Observable<BranchStockSummary | null> {
    const branches = JSON.parse(localStorage.getItem(LOCAL_KEYS.BRANCHES) as string || '[]') as Branch[];
    const branch = branches.find(b => String(b.id) === branchId);
    if (!branch) return of(null);

    const allInventory = JSON.parse(localStorage.getItem(LOCAL_KEYS.BRANCH_INVENTORY) as string || '[]') as BranchInventory[];
    const inventory = allInventory.filter(i => i.branchId === branchId);
    return of(this.computeBranchStockSummary(branch, inventory));
  }

  // ============================================================
  // RESTOCK REQUESTS - ADD THESE METHODS
  // ============================================================

  // The /inventory/restock-requests API names the audit fields createdById/approvedById —
  // this app has always called them createdBy/approvedBy, so map at the boundary rather than
  // renaming the field everywhere it's already used (forms, approval queue, restock list).

  private restockRequestFromApi(raw: any): RestockRequest {
    return {
      ...raw,
      createdBy: raw.createdById,
      approvedBy: raw.approvedById,
      createdAt: raw.createdAt ? new Date(raw.createdAt) : raw.createdAt,
      approvedAt: raw.approvedAt ? new Date(raw.approvedAt) : raw.approvedAt
    };
  }

  private restockRequestToApiPayload(r: Partial<RestockRequest>) {
    return {
      productId: r.productId,
      productName: r.productName,
      sku: r.sku,
      branchId: r.branchId,
      branchName: r.branchName,
      currentStock: r.currentStock,
      reorderPoint: r.reorderPoint,
      safetyStock: r.safetyStock,
      requestedQuantity: r.requestedQuantity,
      approvedQuantity: r.approvedQuantity,
      preferredSupplier: r.preferredSupplier,
      costEstimate: r.costEstimate,
      urgency: r.urgency,
      status: r.status,
      notes: r.notes,
      createdById: r.createdBy,
      createdByName: r.createdByName,
      approvedById: r.approvedBy,
      approvedByName: r.approvedByName,
      purchaseOrderId: r.purchaseOrderId
    };
  }

  /**
   * GET /inventory/restock-requests — falls back to the local mock/localStorage copy if the API
   * is unavailable. The endpoint returns a flat array (not pre-paginated), so filtering/paging
   * is applied client-side either way — passed as query params too, in case the API starts
   * honoring them server-side.
   */
  getRestockRequests(filters?: RestockFilters): Observable<PaginatedResponse<RestockRequest>> {
    this.loadingSubject.next(true);

    let params = new HttpParams().set('tenantId', this.tenantId);
    if (filters?.status) params = params.set('status', filters.status);
    if (filters?.urgency) params = params.set('urgency', filters.urgency);
    if (filters?.branchId) params = params.set('branchId', filters.branchId);
    if (filters?.productId) params = params.set('productId', filters.productId);

    return this.http.get<any[]>(`${this.baseUrl}/inventory/restock-requests`, { params }).pipe(
      map(res => (Array.isArray(res) ? res : []).map(raw => this.restockRequestFromApi(raw))),
      tap(requests => localStorage.setItem('restock_requests', JSON.stringify(requests))),
      catchError(() => of(this.getMockRestockRequests())),
      map(requests => this.paginateRestockRequests(requests, filters)),
      tap(() => this.loadingSubject.next(false))
    );
  }

  /** Shared client-side filter/sort/paginate, used for both the live response and the fallback. */
  private paginateRestockRequests(requests: RestockRequest[], filters?: RestockFilters): PaginatedResponse<RestockRequest> {
    let filtered = requests.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
    if (filters?.status) filtered = filtered.filter(r => r.status === filters.status);
    if (filters?.urgency) filtered = filtered.filter(r => r.urgency === filters.urgency);
    if (filters?.branchId) filtered = filtered.filter(r => r.branchId === filters.branchId);
    if (filters?.productId) filtered = filtered.filter(r => r.productId === filters.productId);

    const page = filters?.page || 0;
    const limit = filters?.limit || filtered.length || 1;
    const start = page * limit;
    const paginatedData = filters ? filtered.slice(start, start + limit) : filtered;

    return {
      data: paginatedData,
      total: filtered.length,
      page,
      limit,
      totalPages: Math.ceil(filtered.length / limit) || 1
    };
  }

  /** POST /inventory/restock-requests — falls back to a local-only record if the API is unavailable. */
  createRestockRequest(request: Partial<RestockRequest>): Observable<RestockRequest> {
    this.loadingSubject.next(true);
    const payload = this.restockRequestToApiPayload({
      status: RestockStatus.PENDING,
      createdBy: 'usr-1',
      createdByName: 'Current User',
      ...request
    });

    return this.http.post<any>(`${this.baseUrl}/inventory/restock-requests`, payload).pipe(
      map(raw => this.restockRequestFromApi(raw)),
      tap(newRequest => {
        const requests = this.getMockRestockRequests();
        requests.push(newRequest);
        localStorage.setItem('restock_requests', JSON.stringify(requests));
        this.loadingSubject.next(false);
      }),
      catchError(err => {
        console.error('[InventoryService] createRestockRequest failed, using local fallback:', err);
        const newRequest: RestockRequest = {
          ...(request as RestockRequest),
          id: Date.now(),
          status: RestockStatus.PENDING,
          createdAt: new Date(),
          approvedAt: new Date(),
          createdBy: 'usr-1',
          createdByName: 'Current User'
        };
        const requests = this.getMockRestockRequests();
        requests.push(newRequest);
        localStorage.setItem('restock_requests', JSON.stringify(requests));
        this.loadingSubject.next(false);
        return of(newRequest);
      })
    );
  }

  /** PATCH /inventory/restock-requests/{id}/status — shared by approve/reject below. */
  private updateRestockRequestStatus(id: string | number, changes: Partial<RestockRequest>): Observable<RestockRequest | null> {
    const numericId = Number(id);
    const requests = this.getMockRestockRequests();
    const index = requests.findIndex(r => r.id === numericId);
    const merged = index > -1 ? { ...requests[index], ...changes } : (changes as RestockRequest);

    return this.http.patch<any>(`${this.baseUrl}/inventory/restock-requests/${numericId}/status`, this.restockRequestToApiPayload(merged)).pipe(
      map(raw => this.restockRequestFromApi(raw)),
      tap(updated => {
        if (index > -1) requests[index] = updated; else requests.push(updated);
        localStorage.setItem('restock_requests', JSON.stringify(requests));
      }),
      catchError(err => {
        console.error('[InventoryService] updateRestockRequestStatus failed, using local fallback:', err);
        if (index === -1) return of(null);
        requests[index] = merged;
        localStorage.setItem('restock_requests', JSON.stringify(requests));
        return of(merged);
      })
    );
  }

  /** Approve a restock request. */
  approveRestockRequest(id: string | number, notes: string): Observable<void> {
    this.loadingSubject.next(true);
    return this.updateRestockRequestStatus(id, {
      status: RestockStatus.APPROVED,
      approvedBy: 'usr-2',
      approvedByName: 'Jane Smith',
      approvedAt: new Date(),
      ...(notes ? { notes } : {})
    }).pipe(
      map(() => undefined),
      tap(() => this.loadingSubject.next(false))
    );
  }

  /** Reject a restock request. */
  rejectRestockRequest(id: string | number, reason: string): Observable<void> {
    this.loadingSubject.next(true);
    return this.updateRestockRequestStatus(id, {
      status: RestockStatus.REJECTED,
      approvedBy: 'usr-2',
      approvedByName: 'Jane Smith',
      approvedAt: new Date(),
      ...(reason ? { notes: reason } : {})
    }).pipe(
      map(() => undefined),
      tap(() => this.loadingSubject.next(false))
    );
  }

  /** GET /inventory/restock-requests/{id} — falls back to the local mock/localStorage copy if the API is unavailable. */
  getRestockRequest(id: string | number): Observable<RestockRequest> {
    const numericId = Number(id);
    return this.http.get<any>(`${this.baseUrl}/inventory/restock-requests/${numericId}`).pipe(
      map(raw => this.restockRequestFromApi(raw)),
      catchError(() => {
        const requests = this.getMockRestockRequests();
        const request = requests.find(r => r.id === numericId);
        return request ? of(request) : throwError(() => new Error('Restock request not found'));
      })
    );
  }

  /**
 * Get restock suggestions for a branch — purely a client-side computation over branch
 * inventory already loaded (which item is below its reorder point), not backed by an endpoint.
 */
  getRestockSuggestions(branchId: string): Observable<RestockRequest[]> {
    const inventory = JSON.parse(localStorage.getItem(LOCAL_KEYS.BRANCH_INVENTORY) as string) as BranchInventory[];
    const branchItems = inventory.filter(i => i.branchId === branchId);

    const suggestions: RestockRequest[] = [];
    branchItems.forEach((item, index) => {
      const status = getStockStatus(item.quantity, item.reorderPoint, item.safetyStock);
      if (status === 'CRITICAL' || status === 'LOW') {
        suggestions.push({
          id: Date.now() + index,
          productId: item.productId,
          productName: item.productName,
          sku: item.sku,
          branchId: item.branchId,
          branchName: item.branchName,
          currentStock: item.quantity,
          reorderPoint: item.reorderPoint,
          safetyStock: item.safetyStock,
          requestedQuantity: item.reorderPoint * 2 - item.quantity,
          approvedQuantity: 0,
          preferredSupplier: '',
          costEstimate: 0,
          urgency: status === 'CRITICAL' ? RestockUrgency.CRITICAL : RestockUrgency.HIGH,
          status: RestockStatus.DRAFT,
          notes: 'Auto-suggested restock',
          createdBy: 'system',
          createdByName: 'System',
          approvedBy: '',
          approvedByName: '',
          createdAt: new Date(),
          approvedAt: new Date(),
          purchaseOrderId: ''
        });
      }
    });

    return of(suggestions);
  }

  /** PUT /inventory/restock-requests/{id} — falls back to updating the local copy if the API is unavailable. */
  updateRestockRequest(id: string | number, request: Partial<RestockRequest>): Observable<RestockRequest> {
    this.loadingSubject.next(true);
    const numericId = Number(id);
    const requests = this.getMockRestockRequests();
    const index = requests.findIndex(r => r.id === numericId);
    if (index === -1) {
      this.loadingSubject.next(false);
      return throwError(() => new Error('Restock request not found'));
    }
    const merged = { ...requests[index], ...request };

    return this.http.put<any>(`${this.baseUrl}/inventory/restock-requests/${numericId}`, this.restockRequestToApiPayload(merged)).pipe(
      map(raw => this.restockRequestFromApi(raw)),
      tap(updated => {
        requests[index] = updated;
        localStorage.setItem('restock_requests', JSON.stringify(requests));
        this.loadingSubject.next(false);
      }),
      catchError(err => {
        console.error('[InventoryService] updateRestockRequest failed, using local fallback:', err);
        requests[index] = merged;
        localStorage.setItem('restock_requests', JSON.stringify(requests));
        this.loadingSubject.next(false);
        return of(merged);
      })
    );
  }

  /** DELETE /inventory/restock-requests/{id} — falls back to removing from the local copy if the API is unavailable. */
  deleteRestockRequest(id: string | number): Observable<void> {
    const numericId = Number(id);
    return this.http.delete<void>(`${this.baseUrl}/inventory/restock-requests/${numericId}`).pipe(
      tap(() => {
        const requests = this.getMockRestockRequests().filter(r => r.id !== numericId);
        localStorage.setItem('restock_requests', JSON.stringify(requests));
      }),
      catchError(err => {
        console.error('[InventoryService] deleteRestockRequest failed, using local fallback:', err);
        const requests = this.getMockRestockRequests().filter(r => r.id !== numericId);
        localStorage.setItem('restock_requests', JSON.stringify(requests));
        return of(void 0);
      })
    );
  }

  /**
   * Get branch inventory for a specific product in a branch
   */
  getBranchInventoryForProduct(branchId: string, productId: string): Observable<BranchInventory | null> {
    const inventory = JSON.parse(localStorage.getItem(LOCAL_KEYS.BRANCH_INVENTORY) as string) as BranchInventory[];
    const item = inventory.find(i => i.branchId === branchId && i.productId === productId);
    return of(item || null);
  }

  /** Resolve a product's category field (id, name, or object) to its display name. */
  private resolveProductCategoryName(product: Product, categories: Category[]): string {
    if (typeof product.category === 'object' && product.category !== null) {
      return (product.category as Category).name || '';
    }
    const raw = product.category ?? (product as any).categoryId;
    if (typeof raw === 'string') {
      const byId = categories.find(c => String(c.id) === String(raw) || c.categoryId === raw);
      return byId?.name || raw;
    }
    return '';
  }

/**
 * Alias for getMovements() - returns stock movements with filters
 * Used by MovementApprovalComponent
 */
  getStockMovements(filters?: MovementFilters): Observable<PaginatedResponse<StockMovement>> {
    return this.getMovements(filters);
  }

  // inventory.service.ts - Add/Update this method

/**
 * Get inventory for a specific branch
 * If branchId is provided, returns only that branch's inventory
 * If no branchId, returns all inventory
 */
/**
 * Get inventory for a specific branch — GET /inventory/stock.
 * If branchId is provided, returns only that branch's inventory.
 * If no branchId, returns all inventory.
 * Returns BranchInventory[] directly (not PaginatedResponse). Falls back to the
 * local mock/localStorage copy if the API is unavailable.
 */
getBranchInventory(branchId?: string): Observable<BranchInventory[]> {
  this.loadingSubject.next(true);

  let params = new HttpParams().set('tenantId', this.tenantId);
  if (branchId) params = params.set('branchId', branchId);

  return this.http.get<BranchInventory[]>(`${this.baseUrl}/inventory/stock`, { params }).pipe(
    map(res => Array.isArray(res) ? res : []),
    map(items => items.sort((a, b) => a.productName.localeCompare(b.productName))),
    tap(items => {
      this.branchInventorySubject.next(items);
      this.loadingSubject.next(false);
    }),
    catchError(() => {
      const allInventory = JSON.parse(localStorage.getItem(LOCAL_KEYS.BRANCH_INVENTORY) as string || '[]') as BranchInventory[];

      let filtered = allInventory;
      if (branchId) {
        filtered = allInventory.filter(item => item.branchId === branchId);
      }

      // Get branch details for the inventory items
      const branches = JSON.parse(localStorage.getItem(LOCAL_KEYS.BRANCHES) as string || '[]') as Branch[];

      // Ensure branch names are populated
      filtered = filtered.map(item => {
        const branch = branches.find(b => String(b.id) === item.branchId);
        return {
          ...item,
          branchName: branch?.name || item.branchName || 'Unknown Branch'
        };
      });

      // Sort by product name
      filtered = filtered.sort((a, b) => a.productName.localeCompare(b.productName));

      this.branchInventorySubject.next(filtered);
      this.loadingSubject.next(false);
      return of(filtered); // Returns BranchInventory[] directly
    })
  );
}

/** Get a single branch inventory record by id — GET /inventory/stock/{id}. */
getBranchInventoryById(id: number): Observable<BranchInventory | null> {
  return this.http.get<BranchInventory>(`${this.baseUrl}/inventory/stock/${id}`).pipe(
    catchError(() => {
      const allInventory = JSON.parse(localStorage.getItem(LOCAL_KEYS.BRANCH_INVENTORY) as string || '[]') as BranchInventory[];
      return of(allInventory.find(i => i.id === id) || null);
    })
  );
}

/** Delete a branch inventory record — DELETE /inventory/stock/{id}. */
deleteBranchInventoryItem(id: number): Observable<void> {
  return this.http.delete<void>(`${this.baseUrl}/inventory/stock/${id}`).pipe(
    tap(() => {
      const allInventory = JSON.parse(localStorage.getItem(LOCAL_KEYS.BRANCH_INVENTORY) as string || '[]') as BranchInventory[];
      const remaining = allInventory.filter(i => i.id !== id);
      localStorage.setItem(LOCAL_KEYS.BRANCH_INVENTORY, JSON.stringify(remaining));
      this.branchInventorySubject.next(remaining);
    }),
    catchError(err => {
      console.error('[InventoryService] deleteBranchInventoryItem failed:', err);
      // Still remove locally so the UI reflects the delete in mock/offline mode.
      const allInventory = JSON.parse(localStorage.getItem(LOCAL_KEYS.BRANCH_INVENTORY) as string || '[]') as BranchInventory[];
      const remaining = allInventory.filter(i => i.id !== id);
      localStorage.setItem(LOCAL_KEYS.BRANCH_INVENTORY, JSON.stringify(remaining));
      this.branchInventorySubject.next(remaining);
      return of(void 0);
    })
  );
}

}
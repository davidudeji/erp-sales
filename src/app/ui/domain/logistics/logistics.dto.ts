// logistics.dto.ts
// ============================================================
// ENUMS
// ============================================================

export enum FulfillmentType {
  UNASSIGNED = 'UNASSIGNED',
  PICKUP = 'PICKUP',
  DELIVERY = 'DELIVERY'
}

export enum OrderStatus {
  PENDING_ROUTING = 'PENDING_ROUTING',
  // pickup lane
  READY_FOR_PICKUP = 'READY_FOR_PICKUP',
  COLLECTED = 'COLLECTED',
  // delivery lane
  POOL = 'POOL',
  CLAIMED = 'CLAIMED',
  ROUTE_PENDING_APPROVAL = 'ROUTE_PENDING_APPROVAL',
  ROUTE_APPROVED = 'ROUTE_APPROVED',
  IN_TRANSIT = 'IN_TRANSIT',
  DELIVERED = 'DELIVERED',
  FAILED = 'FAILED',
  // terminal
  CLOSED = 'CLOSED'
}

export enum BatchStatus {
  CLAIMING = 'CLAIMING',           // rider still adding orders / building route
  ROUTE_SUBMITTED = 'ROUTE_SUBMITTED', // waiting on admin decision
  ROUTE_APPROVED = 'ROUTE_APPROVED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED'
}

export enum StopStatus {
  PENDING = 'PENDING',
  EN_ROUTE = 'EN_ROUTE',
  DELIVERED = 'DELIVERED',
  FAILED = 'FAILED'
}

export enum ProofType {
  SIGNATURE = 'SIGNATURE',
  PHOTO = 'PHOTO',
  CODE = 'CODE'
}

export enum FailureReason {
  NOT_HOME = 'NOT_HOME',
  REFUSED = 'REFUSED',
  WRONG_ADDRESS = 'WRONG_ADDRESS',
  DAMAGED = 'DAMAGED',
  OTHER = 'OTHER'
}

export enum FailedOrderAction {
  REQUEUE = 'REQUEUE',
  CANCEL = 'CANCEL',
  ESCALATE = 'ESCALATE'
}

export enum RiderActiveStatus {
  AVAILABLE = 'AVAILABLE',
  ON_ROUTE = 'ON_ROUTE',
  OFFLINE = 'OFFLINE'
}

export enum VehicleType {
  BIKE = 'BIKE',
  VAN = 'VAN',
  TRUCK = 'TRUCK'
}

// ============================================================
// CORE MODELS
// ============================================================

export interface OrderItem {
  id: string;
  name: string;
  quantity: number;
  note?: string;   // e.g. "Fragile", "Keep upright"
}

export interface Order {
  id: string;               // internal id
  orderId: string;           // display code e.g. #ORD-8821-A
  customerName: string;
  itemsSummary: string;      // e.g. "3 items (Heavy, Fragile)"
  itemCount: number;
  items?: OrderItem[];
  deliveryLocation: string;
  fullAddress?: string;
  area?: string;
  weightKg?: number;
  lat?: number;
  lng?: number;
  expectedReceiverName?: string;
  expectedReceiverPhone?: string;
  deliveryNote?: string;
  paymentStatus: 'paid';
  fulfillmentType: FulfillmentType;
  status: OrderStatus;
  paidAt: string;             // ISO date
  routedAt?: string;
  enteredPoolAt?: string;
  claimedAt?: string;
  batchId?: string;
  riderId?: string;
  riderName?: string;
  deliveryAttemptId?: string;
  isAging?: boolean;          // derived client-side for pool orders
  timeInPoolMinutes?: number; // derived
  priority?: 'standard' | 'high';
  distanceKm?: number;        // derived client-side, rider's distance to stop
}

export interface Rider {
  id: string;
  riderCode?: string;         // display id e.g. R-4921
  name: string;
  initials: string;
  phone?: string;
  email?: string;
  activeStatus: RiderActiveStatus;
  currentBatchId?: string;
  currentLoad: number;        // count of active claimed orders
  vehicleType: VehicleType;
  todayDelivered: number;
  todayFailed: number;
  avgDeliveryMinutes?: number;
}

export interface RouteStop {
  sequence: number;           // 1-based order in the route
  orderId: string;
  orderDisplayId: string;
  location: string;
  itemsSummary: string;
  stopStatus: StopStatus;
  lat?: number;
  lng?: number;
  locationConfirmed?: boolean; // rider has pinned/confirmed the exact drop location
  weightKg?: number;
  customerName?: string;
  area?: string;
  distanceKm?: number;
  requiresSignature?: boolean;
}

export interface DeliveryBatch {
  id: string;
  batchCode: string;          // display e.g. B-7492
  riderId: string;
  riderName: string;
  riderInitials: string;
  vehicleType: VehicleType;
  status: BatchStatus;
  orderIds: string[];
  proposedRoute: RouteStop[];
  totalItems: number;
  isHighPriorityArea?: boolean;
  submittedAt?: string;
  approvedAt?: string;
  approvedBy?: string;
  adminNotes?: string;
  waitMinutes?: number;       // derived: time waiting for approval
  createdAt: string;
}

export interface DeliveryAttempt {
  id: string;
  orderId: string;
  orderDisplayId: string;
  customerName: string;
  deliveryLocation: string;
  batchId: string;
  riderId: string;
  riderName: string;
  riderInitials: string;
  outcome?: 'delivered' | 'failed';
  failureReason?: FailureReason;
  proofOfDeliveryId?: string;
  proof?: ProofOfDelivery;
  attemptedAt?: string;
  escalationNote?: string;
  escalatedAt?: string;
  closedReason?: string;
  isResolved?: boolean; // failed attempts leave the active exceptions list once actioned
}

export interface ProofOfDelivery {
  id: string;
  deliveryAttemptId: string;
  type: ProofType;
  dataUrl?: string;
  code?: string;
  capturedAt: string;
}

export interface AuditLogEntry {
  id: string;
  entityType: 'ORDER' | 'BATCH';
  entityId: string;
  entityDisplayId?: string;
  actor: string;
  actorType: 'admin' | 'rider' | 'system';
  action: string;         // short human label e.g. "Routed to Delivery"
  fromStatus: string;
  toStatus: string;
  note?: string;
  timestamp: string;
}

export interface RiderPerformanceStat {
  riderId: string;
  riderName: string;
  riderInitials: string;
  ordersClaimedWeek: number;
  delivered: number;
  failed: number;
  avgTimeMinutes: number;        // avg claim-to-deliver time
  avgApprovalWaitMinutes: number; // avg time a submitted route sits before approval
  isHoardingRisk: boolean;
}

export interface AuditLogFilter {
  orderId?: string;
  riderId?: string;
  actionType?: string;
  dateRange?: string;
}

export interface RiderCreatePayload {
  name: string;
  email: string;
  phone: string;
  vehicleType: VehicleType;
  activeStatus: RiderActiveStatus;
}

export interface GeoPoint {
  label: string;
  lat: number;
  lng: number;
}

// ============================================================
// RESPONSE WRAPPERS
// ============================================================

export interface TriageListResponse {
  orders: Order[];
  total: number;
}

export interface PoolListResponse {
  orders: Order[];
  total: number;
  agingCount: number;
}

export interface ApprovalQueueResponse {
  batches: DeliveryBatch[];
  total: number;
}

export interface ActiveRoutesResponse {
  batches: DeliveryBatch[];
  total: number;
}

export interface DeliveredListResponse {
  attempts: DeliveryAttempt[];
  total: number;
}

export interface FailedListResponse {
  attempts: DeliveryAttempt[];
  total: number;
}

export interface PickupListResponse {
  orders: Order[];
  total: number;
}

export interface RiderRosterResponse {
  riders: Rider[];
  total: number;
}

export interface RiderPerformanceResponse {
  stats: RiderPerformanceStat[];
  total: number;
  activeRiders: number;
  avgDeliveryRate: number;   // %
  avgTimePerOrderMinutes: number;
  hoardingRiskCount: number;
}

export interface AuditLogResponse {
  entries: AuditLogEntry[];
  total: number;
}

export interface AvailablePoolResponse {
  orders: Order[];
  total: number;
  claimLimit: number;
  currentLoad: number;
}

// ============================================================
// HELPERS
// ============================================================

export const AGING_THRESHOLD_MINUTES = 240; // 4h default, admin-configurable later

export function getOrderStatusLabel(status: OrderStatus): string {
  const map: Record<OrderStatus, string> = {
    [OrderStatus.PENDING_ROUTING]: 'Pending Routing',
    [OrderStatus.READY_FOR_PICKUP]: 'Ready for Pickup',
    [OrderStatus.COLLECTED]: 'Collected',
    [OrderStatus.POOL]: 'In Pool',
    [OrderStatus.CLAIMED]: 'Claimed',
    [OrderStatus.ROUTE_PENDING_APPROVAL]: 'Pending Approval',
    [OrderStatus.ROUTE_APPROVED]: 'Route Approved',
    [OrderStatus.IN_TRANSIT]: 'In Transit',
    [OrderStatus.DELIVERED]: 'Delivered',
    [OrderStatus.FAILED]: 'Failed',
    [OrderStatus.CLOSED]: 'Closed'
  };
  return map[status] ?? status;
}

export function getOrderStatusBadgeClass(status: OrderStatus): string {
  switch (status) {
    case OrderStatus.DELIVERED:
    case OrderStatus.COLLECTED:
      return 'bg-[#00a191]/10 text-[#00a191]';
    case OrderStatus.FAILED:
      return 'bg-[#dc2626]/10 text-[#dc2626]';
    case OrderStatus.IN_TRANSIT:
    case OrderStatus.ROUTE_APPROVED:
      return 'bg-[#2563eb]/10 text-[#2563eb]';
    case OrderStatus.POOL:
    case OrderStatus.READY_FOR_PICKUP:
      return 'bg-[#eab308]/10 text-[#a16207]';
    case OrderStatus.ROUTE_PENDING_APPROVAL:
    case OrderStatus.CLAIMED:
      return 'bg-[#f97316]/10 text-[#f97316]';
    default:
      return 'bg-[#9aa7ae]/10 text-[#566670]';
  }
}

export function getStopStatusBadgeClass(status: StopStatus): string {
  switch (status) {
    case StopStatus.DELIVERED:
      return 'bg-[#16a34a]/10 text-[#16a34a]';
    case StopStatus.FAILED:
      return 'bg-[#dc2626]/10 text-[#dc2626]';
    case StopStatus.EN_ROUTE:
      return 'bg-[#eab308]/10 text-[#a16207]';
    default:
      return 'bg-[#9aa7ae]/10 text-[#566670]';
  }
}

export function minutesBetween(fromIso: string, toIso: string = new Date().toISOString()): number {
  const from = new Date(fromIso).getTime();
  const to = new Date(toIso).getTime();
  return Math.max(0, Math.round((to - from) / 60000));
}

export function formatDuration(mins: number): string {
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

export function getFailureReasonLabel(reason?: FailureReason): string {
  const map: Record<FailureReason, string> = {
    [FailureReason.NOT_HOME]: 'Not Home',
    [FailureReason.REFUSED]: 'Refused',
    [FailureReason.WRONG_ADDRESS]: 'Wrong Address',
    [FailureReason.DAMAGED]: 'Damaged',
    [FailureReason.OTHER]: 'Other'
  };
  return reason ? map[reason] ?? reason : '—';
}

export function getRiderStatusBadgeClass(status: RiderActiveStatus): string {
  switch (status) {
    case RiderActiveStatus.AVAILABLE:
      return 'bg-[#16a34a]/10 text-[#16a34a]';
    case RiderActiveStatus.ON_ROUTE:
      return 'bg-[#2563eb]/10 text-[#2563eb]';
    default:
      return 'bg-[#9aa7ae]/10 text-[#566670]';
  }
}

// ============================================================
// BACKEND WIRE CONTRACT — OptimaX Logistics API v4
// ============================================================
// Verified against the EXPANDED Commerce Swagger (real request/response
// JSON examples for all 30 /x/api/v2/commerce/logistics/* operations),
// not just the collapsed path list. Confirmed specifics that differ from
// a naive reading of the Optimax_Logistics_Models_v4 doc:
//
//  - Primary keys (Order.id, Rider.id, DeliveryBatch.id, DeliveryAttempt.id,
//    ProofOfDelivery.id, OrderItem.id, RiderSummary.id, RouteStop.id) are
//    NUMBERS on the wire, not strings. Business/display codes (orderId,
//    orderDisplayId, riderCode, batchCode) stay strings. The UI-facing
//    models below keep `id: string` everywhere (14 existing components
//    depend on that), so mapApiXxx() does the number→string conversion,
//    and any create/update payload that needs a real numeric id
//    (riderId on batch/attempt create, deliveryAttemptId on proof) does
//    string→number on the way out.
//  - GET /orders, GET /batches, GET /attempts, GET /audit all return a
//    BARE ARRAY — no {data, total} envelope. Only GET /orders/pool,
//    GET /riders and GET /riders/performance use a named-field wrapper
//    (matches the docx's dedicated response DTOs for exactly those three).
//  - None of the GET list endpoints declare any query parameters in the
//    swagger (no `status`, `search`, `outcome`, `riderId`, etc. show up
//    in their parameter tables). They may still be honored server-side
//    (undocumented @RequestParam is common), so the service still sends
//    them, but every list method also filters/sorts client-side as a
//    safety net so the screens are correct even if the backend ignores
//    the querystring entirely.
//  - POST /orders/ingest's real payload is NOT "give me a commerce order
//    id and I'll fetch it" — it's the reverse: the caller supplies the
//    already-fetched Commerce snapshot (orderId, customerName, items,
//    shippingAddress as a plain STRING, receiver info) and Logistics
//    creates its OrderDTO from that, geocoding shippingAddress into its
//    own structured AddressDTO server-side. Fixed accordingly below.
//  - GET /logistics/audit is the real audit-log path (not /audit-log as
//    previously guessed) and its shape matches the docx's
//    AuditLogEntryDTO field-for-field.
//  - The action endpoints — PATCH .../route, .../status, .../approve,
//    .../submit, .../resolve, PATCH /riders/{id}/status — all show a
//    generic `{ additionalProp1: "string", ... }` placeholder as their
//    request body in swagger, i.e. the backend has NOT documented a
//    concrete request schema for any of them. The field names sent below
//    (fulfillmentType, status, riderId, approved, resolutionAction, ...)
//    are still a best-effort guess from the docx, same as before — this
//    is flagged here because it's the one part of the contract that
//    remains genuinely unconfirmed even after reading the expanded page.
// ============================================================

export type OrderPriority = 'STANDARD' | 'HIGH';
export type AttemptOutcome = 'DELIVERED' | 'FAILED';
export type AuditEntityType = 'ORDER' | 'BATCH';
export type AuditActorType = 'ADMIN' | 'RIDER' | 'SYSTEM';

export interface ApiAddress {
  label?: string;
  fullAddress?: string;
  area?: string;
  lat?: number;
  lng?: number;
}

export interface ApiRiderSummary {
  id: number;
  riderCode?: string;
  name: string;
  initials: string;
  vehicleType: VehicleType;
}

export interface ApiOrderItem {
  id: number;
  name: string;
  quantity: number;
  note?: string;
}

export interface ApiOrder {
  id: number;
  tenantId?: string;
  orderId: string;                 // = Commerce SalesandTransactionsDTO.orderId
  customerName: string;
  items?: ApiOrderItem[];
  itemCount?: number;
  deliveryAddress?: ApiAddress;
  weightKg?: number;
  expectedReceiverName?: string;
  expectedReceiverPhone?: string;
  deliveryNote?: string;
  fulfillmentType: FulfillmentType;
  status: OrderStatus;
  priority?: OrderPriority;
  ingestedAt?: string;
  routedAt?: string;
  enteredPoolAt?: string;
  claimedAt?: string;
  batchId?: string;
  rider?: ApiRiderSummary;
  currentDeliveryAttemptId?: number;
  updatedAt?: string;
  // computed, confirmed present on GET responses (never sent on create/update)
  isAging?: boolean;
  timeInPoolMinutes?: number;
}

export interface ApiRider {
  id: number;
  tenantId?: string;
  riderCode?: string;
  name: string;
  initials: string;
  phone?: string;
  email?: string;
  activeStatus: RiderActiveStatus;
  vehicleType: VehicleType;
  currentBatchId?: string;
  currentLoad: number;             // system-maintained only — never sent by the client (Issue 3)
  maxClaimLimit?: number;
  todayDelivered: number;
  todayFailed: number;
  avgDeliveryMinutes?: number;
  createdAt?: string;
  deactivatedAt?: string;
}

export interface ApiRouteStop {
  id?: number;
  batchId?: number;
  sequence: number;
  orderId: string;
  orderDisplayId?: string;
  deliveryAddress?: ApiAddress;
  stopStatus: StopStatus;
  locationConfirmed?: boolean;
  requiresSignature?: boolean;
}

export interface ApiDeliveryBatch {
  id: number;
  tenantId?: string;
  batchCode: string;
  rider: ApiRiderSummary;
  status: BatchStatus;
  orderIds: string[];
  proposedRoute: ApiRouteStop[];
  totalItems: number;
  isHighPriorityArea?: boolean;
  submittedAt?: string;
  approvedAt?: string;
  approvedBy?: string;
  adminNotes?: string;
  createdAt: string;
  waitMinutes?: number;            // computed — present on GET, never sent on create/update
}

export interface ApiProofOfDelivery {
  id: number;
  deliveryAttemptId: number;
  type: ProofType;
  fileUrl?: string;
  code?: string;
  capturedAt: string;
}

// Confirmed FLAT on the wire — order reference fields sit directly on the
// attempt (orderId / orderDisplayId / customerName), there's no nested
// "order" object as the docx table wording ("order: RiderSummaryDTO")
// seemed to imply. That was a docx wording quirk, not the real shape.
export interface ApiDeliveryAttempt {
  id: number;
  tenantId?: string;
  orderId: string;
  orderDisplayId?: string;
  customerName?: string;
  batchId: string;
  rider: ApiRiderSummary;
  outcome: AttemptOutcome;
  failureReason?: FailureReason;
  proofOfDelivery?: ApiProofOfDelivery;
  attemptedAt: string;
  escalationNote?: string;
  escalatedAt?: string;
  resolutionAction?: FailedOrderAction;
  closedReason?: string;
  isResolved?: boolean;
}

export interface ApiAuditLogEntry {
  id: number;
  tenantId?: string;
  entityType: AuditEntityType;
  entityId: string;
  entityDisplayId?: string;
  actorId?: string;
  actorName: string;
  actorType: AuditActorType;
  action: string;
  fromStatus: string;
  toStatus: string;
  note?: string;
  timestamp: string;
}

export interface ApiRiderPerformanceStat {
  rider: ApiRiderSummary;
  ordersClaimedWeek: number;
  delivered: number;
  failed: number;
  avgTimeMinutes: number;
  avgApprovalWaitMinutes: number;
  isHoardingRisk: boolean;
}

export interface ApiPoolListResponse {
  orders: ApiOrder[];
  total: number;
  agingCount: number;
}

export interface ApiRiderRosterResponse {
  riders: ApiRider[];
  total: number;
}

export interface ApiRiderPerformanceResponse {
  stats: ApiRiderPerformanceStat[];
  total: number;
  activeRiders: number;
  avgDeliveryRate: number;
  avgTimePerOrderMinutes: number;
  hoardingRiskCount: number;
}

// ---- CREATE / one-off payloads ----
// No `id` field: the backend assigns identity on create. Updates instead
// address the record purely via the `{id}` path segment on PUT/PATCH.
export interface ApiOrderCreatePayload {
  orderId: string;
  customerName: string;
  items?: ApiOrderItem[];
  deliveryAddress?: ApiAddress;
  weightKg?: number;
  expectedReceiverName?: string;
  expectedReceiverPhone?: string;
  deliveryNote?: string;
  fulfillmentType?: FulfillmentType;
  priority?: OrderPriority;
}

// Confirmed shape for POST /orders/ingest: the caller hands over the
// already-fetched Commerce snapshot; Logistics geocodes shippingAddress
// (a plain string, per Commerce's SalesandTransactionsDTO) into its own
// AddressDTO server-side and creates the OrderDTO from this.
export interface ApiIngestPayload {
  orderId: string;                 // Commerce SalesandTransactionsDTO.orderId, at PAYMENT_COMPLETED
  customerName: string;
  items?: ApiOrderItem[];
  shippingAddress?: string;
  expectedReceiverName?: string;
  expectedReceiverPhone?: string;
  deliveryNote?: string;
}

export interface ApiBatchCreatePayload {
  riderId: number;
  orderIds: string[];
}

export interface ApiAttemptCreatePayload {
  orderId: string;
  batchId: string;
  riderId: number;
  outcome: AttemptOutcome;
  failureReason?: FailureReason;
}

export interface ApiProofCreatePayload {
  deliveryAttemptId: number;
  type: ProofType;
  fileUrl?: string;
  code?: string;
}

export interface ApiRiderCreatePayload {
  name: string;
  email: string;
  phone: string;
  vehicleType: VehicleType;
  activeStatus: RiderActiveStatus;
  maxClaimLimit?: number;
}

// ============================================================
// MAPPERS — backend v4 wire shape  ⇄  existing UI-facing flat models
// (numeric wire ids are coerced to strings here so the 14 existing
// components — which compare/store ids as strings — need no changes)
// ============================================================

function summarizeItems(items?: ApiOrderItem[]): string {
  if (!items || !items.length) return '';
  const count = items.reduce((s, i) => s + (i.quantity || 0), 0);
  const notes = Array.from(new Set(items.map((i) => i.note).filter((n): n is string => !!n)));
  return notes.length ? `${count} items (${notes.join(', ')})` : `${count} item${count === 1 ? '' : 's'}`;
}

export function mapApiOrder(a: ApiOrder): Order {
  const timeInPoolMinutes = a.timeInPoolMinutes ?? (a.enteredPoolAt ? minutesBetween(a.enteredPoolAt) : undefined);
  return {
    id: String(a.id),
    orderId: a.orderId,
    customerName: a.customerName,
    itemsSummary: summarizeItems(a.items),
    itemCount: a.itemCount ?? (a.items?.reduce((s, i) => s + (i.quantity || 0), 0) ?? 0),
    items: a.items?.map((i) => ({ id: String(i.id), name: i.name, quantity: i.quantity, note: i.note })),
    deliveryLocation: a.deliveryAddress?.label || a.deliveryAddress?.area || a.deliveryAddress?.fullAddress || '',
    fullAddress: a.deliveryAddress?.fullAddress,
    area: a.deliveryAddress?.area,
    weightKg: a.weightKg,
    lat: a.deliveryAddress?.lat,
    lng: a.deliveryAddress?.lng,
    expectedReceiverName: a.expectedReceiverName,
    expectedReceiverPhone: a.expectedReceiverPhone,
    deliveryNote: a.deliveryNote,
    paymentStatus: 'paid',
    fulfillmentType: a.fulfillmentType,
    status: a.status,
    paidAt: a.ingestedAt || a.updatedAt || new Date().toISOString(),
    routedAt: a.routedAt,
    enteredPoolAt: a.enteredPoolAt,
    claimedAt: a.claimedAt,
    batchId: a.batchId,
    riderId: a.rider ? String(a.rider.id) : undefined,
    riderName: a.rider?.name,
    deliveryAttemptId: a.currentDeliveryAttemptId !== undefined ? String(a.currentDeliveryAttemptId) : undefined,
    isAging: a.isAging ?? (timeInPoolMinutes !== undefined ? timeInPoolMinutes >= AGING_THRESHOLD_MINUTES : undefined),
    timeInPoolMinutes,
    priority: a.priority === 'HIGH' ? 'high' : 'standard'
  };
}

export function mapApiRider(a: ApiRider): Rider {
  return {
    id: String(a.id),
    riderCode: a.riderCode,
    name: a.name,
    initials: a.initials,
    phone: a.phone,
    email: a.email,
    activeStatus: a.activeStatus,
    currentBatchId: a.currentBatchId,
    currentLoad: a.currentLoad,
    vehicleType: a.vehicleType,
    todayDelivered: a.todayDelivered,
    todayFailed: a.todayFailed,
    avgDeliveryMinutes: a.avgDeliveryMinutes
  };
}

export function mapApiRouteStop(a: ApiRouteStop): RouteStop {
  return {
    sequence: a.sequence,
    orderId: a.orderId,
    orderDisplayId: a.orderDisplayId || a.orderId,
    location: a.deliveryAddress?.label || a.deliveryAddress?.fullAddress || '',
    itemsSummary: '',
    stopStatus: a.stopStatus,
    lat: a.deliveryAddress?.lat,
    lng: a.deliveryAddress?.lng,
    locationConfirmed: a.locationConfirmed,
    area: a.deliveryAddress?.area,
    requiresSignature: a.requiresSignature
  };
}

export function mapApiBatch(a: ApiDeliveryBatch): DeliveryBatch {
  return {
    id: String(a.id),
    batchCode: a.batchCode,
    riderId: a.rider ? String(a.rider.id) : '',
    riderName: a.rider?.name || '',
    riderInitials: a.rider?.initials || '',
    vehicleType: a.rider?.vehicleType || VehicleType.BIKE,
    status: a.status,
    orderIds: a.orderIds || [],
    proposedRoute: (a.proposedRoute || []).map(mapApiRouteStop),
    totalItems: a.totalItems,
    isHighPriorityArea: a.isHighPriorityArea,
    submittedAt: a.submittedAt,
    approvedAt: a.approvedAt,
    approvedBy: a.approvedBy,
    adminNotes: a.adminNotes,
    waitMinutes: a.waitMinutes ?? (a.submittedAt ? minutesBetween(a.submittedAt) : undefined),
    createdAt: a.createdAt
  };
}

export function mapApiAttempt(a: ApiDeliveryAttempt): DeliveryAttempt {
  return {
    id: String(a.id),
    orderId: a.orderId || '',
    orderDisplayId: a.orderDisplayId || a.orderId || '',
    customerName: a.customerName || '',
    deliveryLocation: '',
    batchId: a.batchId || '',
    riderId: a.rider ? String(a.rider.id) : '',
    riderName: a.rider?.name || '',
    riderInitials: a.rider?.initials || '',
    outcome: a.outcome === 'DELIVERED' ? 'delivered' : 'failed',
    failureReason: a.failureReason,
    proofOfDeliveryId: a.proofOfDelivery ? String(a.proofOfDelivery.id) : undefined,
    proof: a.proofOfDelivery
      ? {
          id: String(a.proofOfDelivery.id),
          deliveryAttemptId: String(a.proofOfDelivery.deliveryAttemptId),
          type: a.proofOfDelivery.type,
          dataUrl: a.proofOfDelivery.fileUrl,
          code: a.proofOfDelivery.code,
          capturedAt: a.proofOfDelivery.capturedAt
        }
      : undefined,
    attemptedAt: a.attemptedAt,
    escalationNote: a.escalationNote,
    escalatedAt: a.escalatedAt,
    closedReason: a.closedReason,
    isResolved: a.isResolved
  };
}

export function mapApiAuditEntry(a: ApiAuditLogEntry): AuditLogEntry {
  return {
    id: String(a.id),
    entityType: a.entityType,
    entityId: a.entityId,
    entityDisplayId: a.entityDisplayId,
    actor: a.actorName,
    actorType: (a.actorType ? a.actorType.toLowerCase() : 'system') as 'admin' | 'rider' | 'system',
    action: a.action,
    fromStatus: a.fromStatus,
    toStatus: a.toStatus,
    note: a.note,
    timestamp: a.timestamp
  };
}

export function mapApiPerformanceStat(a: ApiRiderPerformanceStat): RiderPerformanceStat {
  return {
    riderId: a.rider ? String(a.rider.id) : '',
    riderName: a.rider?.name || '',
    riderInitials: a.rider?.initials || '',
    ordersClaimedWeek: a.ordersClaimedWeek,
    delivered: a.delivered,
    failed: a.failed,
    avgTimeMinutes: a.avgTimeMinutes,
    avgApprovalWaitMinutes: a.avgApprovalWaitMinutes,
    isHoardingRisk: a.isHoardingRisk
  };
}

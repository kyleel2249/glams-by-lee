/** Mirrors is_valid_order_transition() in supabase/migrations/0002. The database is the enforcer; this keeps the UI honest. */
export const ORDER_STATUSES = [
  'pending_payment', 'payment_processing', 'paid', 'processing', 'ready_for_dispatch', 'shipped',
  'delivered', 'cancelled', 'refund_pending', 'partially_refunded', 'refunded', 'payment_failed',
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

const TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  pending_payment: ['payment_processing', 'paid', 'payment_failed', 'cancelled'],
  payment_processing: ['paid', 'payment_failed', 'cancelled'],
  payment_failed: ['payment_processing', 'paid', 'cancelled'],
  paid: ['processing', 'cancelled', 'refund_pending'],
  processing: ['ready_for_dispatch', 'cancelled', 'refund_pending'],
  ready_for_dispatch: ['shipped', 'cancelled', 'refund_pending'],
  shipped: ['delivered', 'refund_pending'],
  delivered: ['refund_pending'],
  refund_pending: ['partially_refunded', 'refunded', 'paid', 'processing', 'delivered'],
  partially_refunded: ['refund_pending', 'refunded'],
  cancelled: [],
  refunded: [],
};

export const canTransition = (from: OrderStatus, to: OrderStatus) => TRANSITIONS[from].includes(to);
export const nextStatuses = (from: OrderStatus) => TRANSITIONS[from];

/** Statuses whose money counts as verified revenue (refunds are netted separately in reports). */
export const REVENUE_STATUSES: readonly OrderStatus[] = [
  'paid', 'processing', 'ready_for_dispatch', 'shipped', 'delivered', 'partially_refunded', 'refund_pending',
];

export const STATUS_LABEL: Record<OrderStatus, string> = {
  pending_payment: 'Pending payment', payment_processing: 'Payment processing', paid: 'Paid',
  processing: 'Processing', ready_for_dispatch: 'Ready for dispatch', shipped: 'Shipped', delivered: 'Delivered',
  cancelled: 'Cancelled', refund_pending: 'Refund pending', partially_refunded: 'Partially refunded',
  refunded: 'Refunded', payment_failed: 'Payment failed',
};

export const STAFF_ROLES = ['owner', 'store_manager', 'order_manager', 'inventory_manager', 'customer_support', 'content_editor'] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

export const ROLE_LABEL: Record<StaffRole, string> = {
  owner: 'Owner', store_manager: 'Store manager', order_manager: 'Order manager', inventory_manager: 'Inventory manager', customer_support: 'Customer support', content_editor: 'Content editor',
};

/** Mirrors the row-level-security policies in supabase/migrations/0003. The server enforces this; hiding a button is only cosmetic. */
const MATRIX = {
  'dashboard.view': ['store_manager', 'order_manager', 'inventory_manager', 'customer_support', 'content_editor'],
  'orders.view': ['store_manager', 'order_manager', 'customer_support'],
  'orders.update': ['store_manager', 'order_manager'],
  'orders.export': ['store_manager', 'order_manager'],
  'refunds.manage': ['store_manager', 'order_manager'],
  'products.write': ['store_manager', 'inventory_manager', 'content_editor'],
  'variants.write': ['store_manager', 'inventory_manager'],
  'inventory.view': ['store_manager', 'inventory_manager', 'order_manager'],
  'inventory.adjust': ['store_manager', 'inventory_manager'],
  'categories.write': ['store_manager', 'content_editor'],
  'discounts.write': ['store_manager'],
  'shipping.write': ['store_manager'],
  'content.write': ['store_manager', 'content_editor'],
  'settings.write': ['store_manager'],
  'reviews.moderate': ['store_manager', 'customer_support'],
  'privacy.manage': ['store_manager'],
  'audit.view': [],
  'roles.manage': [],
} as const satisfies Record<string, readonly StaffRole[]>;

export type Permission = keyof typeof MATRIX;
export const PERMISSIONS = Object.keys(MATRIX) as Permission[];

/** The owner can do everything. Everyone else needs a role listed for the permission. */
export function can(roles: readonly StaffRole[], permission: Permission): boolean {
  if (roles.includes('owner')) return true;
  return roles.some((r) => (MATRIX[permission] as readonly StaffRole[]).includes(r));
}

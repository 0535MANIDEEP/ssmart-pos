// Permission definitions and role → permission mappings
// Permissions follow the format "resource:action" (e.g. "products:read")

const PERMISSIONS = {
  PRODUCTS_READ: 'products:read',
  PRODUCTS_WRITE: 'products:write',
  PRODUCTS_DELETE: 'products:delete',
  CUSTOMERS_READ: 'customers:read',
  CUSTOMERS_WRITE: 'customers:write',
  INVOICES_READ: 'invoices:read',
  INVOICES_CREATE: 'invoices:create',
  INVOICES_RETURN: 'invoices:return',
  SUPPLIERS_READ: 'suppliers:read',
  SUPPLIERS_WRITE: 'suppliers:write',
  SUPPLIERS_DELETE: 'suppliers:delete',
  PURCHASES_READ: 'purchases:read',
  PURCHASES_CREATE: 'purchases:create',
  PURCHASES_RETURN: 'purchases:return',
  ACCOUNTING_READ: 'accounting:read',
  ACCOUNTING_WRITE: 'accounting:write',
  ACCOUNTING_MANAGE: 'accounting:manage',
  EXPENSES_READ: 'expenses:read',
  EXPENSES_WRITE: 'expenses:write',
  REPORTS_VIEW: 'reports:view',
  SETTINGS_READ: 'settings:read',
  SETTINGS_WRITE: 'settings:write',
  USERS_READ: 'users:read',
  USERS_MANAGE: 'users:manage',
  BACKUP_MANAGE: 'backup:manage',
  MIGRATION_RUN: 'migration:run',
};

const ROLE_PERMISSIONS = {
  admin: Object.values(PERMISSIONS),
  manager: [
    PERMISSIONS.PRODUCTS_READ,
    PERMISSIONS.PRODUCTS_WRITE,
    PERMISSIONS.CUSTOMERS_READ,
    PERMISSIONS.CUSTOMERS_WRITE,
    PERMISSIONS.INVOICES_READ,
    PERMISSIONS.INVOICES_CREATE,
    PERMISSIONS.INVOICES_RETURN,
    PERMISSIONS.SUPPLIERS_READ,
    PERMISSIONS.SUPPLIERS_WRITE,
    PERMISSIONS.PURCHASES_READ,
    PERMISSIONS.PURCHASES_CREATE,
    PERMISSIONS.ACCOUNTING_READ,
    PERMISSIONS.ACCOUNTING_WRITE,
    PERMISSIONS.EXPENSES_READ,
    PERMISSIONS.EXPENSES_WRITE,
    PERMISSIONS.REPORTS_VIEW,
    PERMISSIONS.SETTINGS_READ,
    PERMISSIONS.USERS_READ,
  ],
  accountant: [
    PERMISSIONS.PRODUCTS_READ,
    PERMISSIONS.CUSTOMERS_READ,
    PERMISSIONS.INVOICES_READ,
    PERMISSIONS.ACCOUNTING_READ,
    PERMISSIONS.ACCOUNTING_WRITE,
    PERMISSIONS.ACCOUNTING_MANAGE,
    PERMISSIONS.EXPENSES_READ,
    PERMISSIONS.EXPENSES_WRITE,
    PERMISSIONS.REPORTS_VIEW,
    PERMISSIONS.SETTINGS_READ,
  ],
  cashier: [
    PERMISSIONS.PRODUCTS_READ,
    PERMISSIONS.CUSTOMERS_READ,
    PERMISSIONS.CUSTOMERS_WRITE,
    PERMISSIONS.INVOICES_READ,
    PERMISSIONS.INVOICES_CREATE,
    PERMISSIONS.INVOICES_RETURN,
    PERMISSIONS.EXPENSES_READ,
  ],
};

function getPermissionsForUser(user) {
  if (user.permissions && user.permissions !== '[]') {
    try {
      const custom = JSON.parse(user.permissions);
      if (Array.isArray(custom) && custom.length > 0) return custom;
    } catch {}
  }
  return ROLE_PERMISSIONS[user.role] || ROLE_PERMISSIONS.cashier;
}

module.exports = { PERMISSIONS, ROLE_PERMISSIONS, getPermissionsForUser };

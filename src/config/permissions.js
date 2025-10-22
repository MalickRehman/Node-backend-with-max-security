/**
 * Permission Configuration
 * Defines all permissions and role-permission mappings
 */

/**
 * Available Permissions
 * Each permission represents a specific action that can be performed
 */
export const PERMISSIONS = {
  // User Permissions
  USER_READ: 'user:read',
  USER_CREATE: 'user:create',
  USER_UPDATE: 'user:update',
  USER_DELETE: 'user:delete',
  USER_LIST: 'user:list',

  // Profile Permissions (own profile)
  PROFILE_READ: 'profile:read',
  PROFILE_UPDATE: 'profile:update',
  PROFILE_DELETE: 'profile:delete',

  // Role Management Permissions
  ROLE_READ: 'role:read',
  ROLE_UPDATE: 'role:update',
  ROLE_ASSIGN: 'role:assign',

  // Audit Log Permissions
  AUDIT_READ: 'audit:read',
  AUDIT_LIST: 'audit:list',
  AUDIT_EXPORT: 'audit:export',

  // Settings Permissions
  SETTINGS_READ: 'settings:read',
  SETTINGS_UPDATE: 'settings:update',

  // System Permissions
  SYSTEM_ADMIN: 'system:admin',
  SYSTEM_MAINTENANCE: 'system:maintenance',
};

/**
 * Role-Permission Mappings
 * Defines which permissions each role has
 */
export const ROLE_PERMISSIONS = {
  // Guest - Minimal permissions
  guest: [PERMISSIONS.PROFILE_READ],

  // User - Standard user permissions
  user: [
    PERMISSIONS.PROFILE_READ,
    PERMISSIONS.PROFILE_UPDATE,
    PERMISSIONS.USER_READ, // Can read other users' public info
  ],

  // Moderator - Extended permissions
  moderator: [
    PERMISSIONS.PROFILE_READ,
    PERMISSIONS.PROFILE_UPDATE,
    PERMISSIONS.USER_READ,
    PERMISSIONS.USER_LIST,
    PERMISSIONS.USER_UPDATE, // Can update other users
    PERMISSIONS.AUDIT_READ,
    PERMISSIONS.AUDIT_LIST,
  ],

  // Admin - All permissions
  admin: [
    ...Object.values(PERMISSIONS), // Admins have all permissions
  ],
};

/**
 * Check if a role has a specific permission
 */
export const hasPermission = (role, permission) => {
  if (!role || !permission) return false;

  const rolePermissions = ROLE_PERMISSIONS[role] || [];
  return rolePermissions.includes(permission);
};

/**
 * Check if a role has all of the specified permissions
 */
export const hasAllPermissions = (role, permissions) => {
  if (!role || !permissions || !Array.isArray(permissions)) return false;

  const rolePermissions = ROLE_PERMISSIONS[role] || [];
  return permissions.every((permission) => rolePermissions.includes(permission));
};

/**
 * Check if a role has any of the specified permissions
 */
export const hasAnyPermission = (role, permissions) => {
  if (!role || !permissions || !Array.isArray(permissions)) return false;

  const rolePermissions = ROLE_PERMISSIONS[role] || [];
  return permissions.some((permission) => rolePermissions.includes(permission));
};

/**
 * Get all permissions for a role
 */
export const getRolePermissions = (role) => {
  return ROLE_PERMISSIONS[role] || [];
};

/**
 * Resource ownership check
 * Determines if a user owns a specific resource
 */
export const isResourceOwner = (userId, resourceOwnerId) => {
  return userId === resourceOwnerId || userId === resourceOwnerId?.toString();
};

/**
 * Permission hierarchy levels
 * Higher level roles can perform actions of lower level roles
 */
export const ROLE_HIERARCHY = {
  guest: 0,
  user: 1,
  moderator: 2,
  admin: 3,
};

/**
 * Check if role1 has higher or equal hierarchy than role2
 */
export const hasHigherOrEqualRole = (role1, role2) => {
  const level1 = ROLE_HIERARCHY[role1] ?? -1;
  const level2 = ROLE_HIERARCHY[role2] ?? -1;
  return level1 >= level2;
};

export default {
  PERMISSIONS,
  ROLE_PERMISSIONS,
  ROLE_HIERARCHY,
  hasPermission,
  hasAllPermissions,
  hasAnyPermission,
  getRolePermissions,
  isResourceOwner,
  hasHigherOrEqualRole,
};

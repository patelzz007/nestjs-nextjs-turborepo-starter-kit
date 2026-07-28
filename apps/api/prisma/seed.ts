import "dotenv/config"
import {
  PrismaClient,
  Permission,
  Role,
  User,
  Url,
  Tag,
  MenuItem,
  PermissionAction,
  PermissionResource,
  DeviceType,
  RedirectType,
  Plan,
} from "@prisma/client"
import * as bcrypt from "bcrypt"
import * as crypto from "crypto"
import { PrismaPg } from "@prisma/adapter-pg"

const prisma: PrismaClient = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: process.env.DATABASE_URL!,
  }),
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const rand = <T>(arr: T[]): T => {
  const index = Math.floor(Math.random() * arr.length)
  const value = arr[index]
  if (value === undefined) throw new Error("rand: unexpected undefined")
  return value
}
const randInt = (min: number, max: number) =>
  Math.floor(Math.random() * (max - min + 1)) + min
const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000)
const daysFromNow = (n: number) => new Date(Date.now() + n * 86_400_000)

/** Safely get an array element using modulo cycling. Assumes the array is non-empty. */
const cycle = <T>(arr: T[], i: number): T => {
  const val = arr[i % arr.length]
  if (val === undefined) throw new Error("cycle: unexpected undefined")
  return val
}

// ---------------------------------------------------------------------------
// Seed data constants
// ---------------------------------------------------------------------------

const COUNTRIES = [
  "MY",
  "US",
  "GB",
  "SG",
  "AU",
  "IN",
  "DE",
  "JP",
  "CA",
  "FR",
  "BR",
  "KR",
]
const CITIES = [
  "Kuala Lumpur",
  "New York",
  "London",
  "Singapore",
  "Sydney",
  "Mumbai",
  "Berlin",
  "Tokyo",
  "Toronto",
  "Paris",
  "São Paulo",
  "Seoul",
]
const DEVICES: DeviceType[] = [
  "DESKTOP",
  "DESKTOP",
  "MOBILE",
  "MOBILE",
  "MOBILE",
  "TABLET",
  "BOT",
]
const OSS = [
  "Windows",
  "macOS",
  "Android",
  "iOS",
  "Linux",
  "Ubuntu",
  "ChromeOS",
]
const BROWSERS = [
  "Chrome",
  "Safari",
  "Firefox",
  "Edge",
  "Samsung Internet",
  "Opera",
  "Brave",
]
const REFERRERS = [
  "https://google.com",
  "https://twitter.com",
  "https://facebook.com",
  "https://linkedin.com",
  "https://reddit.com",
  "https://instagram.com",
  null,
  null,
  null, // nulls = direct traffic (weighted higher)
]
const UTM_SOURCES = [
  "google",
  "facebook",
  "twitter",
  "linkedin",
  "email",
  "newsletter",
]
const UTM_MEDIUMS = ["cpc", "social", "email", "organic", "referral", "display"]

// ---------------------------------------------------------------------------
// 1. Permissions
// ---------------------------------------------------------------------------

interface PermissionData {
  action: PermissionAction
  resource: PermissionResource
  description: string
  group: string
  isSystem?: boolean
}

async function createPermissions(): Promise<Permission[]> {
  const data: PermissionData[] = [
    // User Management group
    {
      action: "CREATE",
      resource: "USER",
      description: "Create new users",
      group: "User Management",
    },
    {
      action: "READ",
      resource: "USER",
      description: "View user details",
      group: "User Management",
    },
    {
      action: "UPDATE",
      resource: "USER",
      description: "Update user information",
      group: "User Management",
    },
    {
      action: "DELETE",
      resource: "USER",
      description: "Delete users",
      group: "User Management",
    },
    {
      action: "LIST",
      resource: "USER",
      description: "List all users",
      group: "User Management",
    },
    {
      action: "MANAGE",
      resource: "USER",
      description: "Full user management",
      group: "User Management",
    },

    // Profile Management group
    {
      action: "CREATE",
      resource: "PROFILE",
      description: "Create user profiles",
      group: "Profile Management",
    },
    {
      action: "READ",
      resource: "PROFILE",
      description: "View user profiles",
      group: "Profile Management",
    },
    {
      action: "UPDATE",
      resource: "PROFILE",
      description: "Update user profiles",
      group: "Profile Management",
    },
    {
      action: "DELETE",
      resource: "PROFILE",
      description: "Delete user profiles",
      group: "Profile Management",
    },
    {
      action: "LIST",
      resource: "PROFILE",
      description: "List user profiles",
      group: "Profile Management",
    },
    {
      action: "MANAGE",
      resource: "PROFILE",
      description: "Full profile management",
      group: "Profile Management",
    },

    // Role Management group
    {
      action: "CREATE",
      resource: "ROLE",
      description: "Create new roles",
      group: "Role Management",
      isSystem: true,
    },
    {
      action: "READ",
      resource: "ROLE",
      description: "View role details",
      group: "Role Management",
    },
    {
      action: "UPDATE",
      resource: "ROLE",
      description: "Update role information",
      group: "Role Management",
      isSystem: true,
    },
    {
      action: "DELETE",
      resource: "ROLE",
      description: "Delete roles",
      group: "Role Management",
      isSystem: true,
    },
    {
      action: "LIST",
      resource: "ROLE",
      description: "List all roles",
      group: "Role Management",
    },
    {
      action: "MANAGE",
      resource: "ROLE",
      description: "Full role management",
      group: "Role Management",
      isSystem: true,
    },

    // Permission Management group
    {
      action: "CREATE",
      resource: "PERMISSION",
      description: "Create new permissions",
      group: "Permission Management",
      isSystem: true,
    },
    {
      action: "READ",
      resource: "PERMISSION",
      description: "View permission details",
      group: "Permission Management",
    },
    {
      action: "UPDATE",
      resource: "PERMISSION",
      description: "Update permission information",
      group: "Permission Management",
      isSystem: true,
    },
    {
      action: "DELETE",
      resource: "PERMISSION",
      description: "Delete permissions",
      group: "Permission Management",
      isSystem: true,
    },
    {
      action: "LIST",
      resource: "PERMISSION",
      description: "List all permissions",
      group: "Permission Management",
    },
    {
      action: "MANAGE",
      resource: "PERMISSION",
      description: "Full permission management",
      group: "Permission Management",
      isSystem: true,
    },

    // Admin Dashboard group
    {
      action: "READ",
      resource: "ADMIN_DASHBOARD",
      description: "Access admin dashboard",
      group: "Admin Dashboard",
    },
    {
      action: "MANAGE",
      resource: "ADMIN_DASHBOARD",
      description: "Full admin dashboard access",
      group: "Admin Dashboard",
    },

    // System Settings group
    {
      action: "READ",
      resource: "SYSTEM_SETTINGS",
      description: "View system settings",
      group: "System Settings",
    },
    {
      action: "UPDATE",
      resource: "SYSTEM_SETTINGS",
      description: "Update system settings",
      group: "System Settings",
    },
    {
      action: "MANAGE",
      resource: "SYSTEM_SETTINGS",
      description: "Full system management",
      group: "System Settings",
      isSystem: true,
    },

    // URL Management group
    {
      action: "LIST",
      resource: "URL",
      description: "List all URLs",
      group: "URL Management",
    },
    {
      action: "READ",
      resource: "URL",
      description: "View any URL details",
      group: "URL Management",
    },
    {
      action: "UPDATE",
      resource: "URL",
      description: "Update any URL",
      group: "URL Management",
    },
    {
      action: "DELETE",
      resource: "URL",
      description: "Delete any URL",
      group: "URL Management",
    },
    {
      action: "MANAGE",
      resource: "URL",
      description: "Full URL management",
      group: "URL Management",
    },

    // API Key Management group
    {
      action: "LIST",
      resource: "API_KEY",
      description: "List all API keys",
      group: "API Key Management",
    },
    {
      action: "READ",
      resource: "API_KEY",
      description: "View any API key details",
      group: "API Key Management",
    },
    {
      action: "MANAGE",
      resource: "API_KEY",
      description: "Full API key management",
      group: "API Key Management",
    },

    // Audit Log group
    {
      action: "READ",
      resource: "AUDIT_LOG",
      description: "View audit logs",
      group: "Audit",
    },
    {
      action: "LIST",
      resource: "AUDIT_LOG",
      description: "List audit logs",
      group: "Audit",
    },
    {
      action: "MANAGE",
      resource: "AUDIT_LOG",
      description: "Full audit log management",
      group: "Audit",
      isSystem: true,
    },

    // Tag Management group
    {
      action: "CREATE",
      resource: "TAG",
      description: "Create tags",
      group: "Tag Management",
    },
    {
      action: "READ",
      resource: "TAG",
      description: "View tag details",
      group: "Tag Management",
    },
    {
      action: "UPDATE",
      resource: "TAG",
      description: "Update tags",
      group: "Tag Management",
    },
    {
      action: "DELETE",
      resource: "TAG",
      description: "Delete tags",
      group: "Tag Management",
    },
    {
      action: "LIST",
      resource: "TAG",
      description: "List all tags",
      group: "Tag Management",
    },
    {
      action: "MANAGE",
      resource: "TAG",
      description: "Full tag management",
      group: "Tag Management",
    },

    // Analytics group
    {
      action: "READ",
      resource: "ANALYTICS",
      description: "View analytics data",
      group: "Analytics",
    },
    {
      action: "LIST",
      resource: "ANALYTICS",
      description: "List analytics records",
      group: "Analytics",
    },
    {
      action: "MANAGE",
      resource: "ANALYTICS",
      description: "Full analytics management",
      group: "Analytics",
    },

    // Reports group (ABAC-ready — conditions can be set via PATCH /rbac/permissions/:id)
    // See docs/rbac.md §12 for ABAC condition syntax and usage.
    {
      action: "READ",
      resource: "REPORT",
      description: "View reports",
      group: "Reports",
    },
    {
      action: "LIST",
      resource: "REPORT",
      description: "List reports",
      group: "Reports",
    },
    {
      action: "MANAGE",
      resource: "REPORT",
      description: "Full report management",
      group: "Reports",
    },
  ]

  for (const p of data) {
    await prisma.permission.upsert({
      where: { action_resource: { action: p.action, resource: p.resource } },
      update: {
        description: p.description,
        group: p.group,
        isSystem: p.isSystem ?? false,
      },
      create: {
        action: p.action,
        resource: p.resource,
        description: p.description,
        group: p.group,
        isSystem: p.isSystem ?? false,
      },
    })
  }

  return prisma.permission.findMany()
}

// ---------------------------------------------------------------------------
// 2. Roles
// ---------------------------------------------------------------------------

async function createRoles(): Promise<Role[]> {
  const data = [
    { name: "SuperAdmin", description: "Full system access", isActive: true },
    { name: "Admin", description: "Administrative access", isActive: true },
    { name: "Manager", description: "Management level access", isActive: true },
    { name: "User", description: "Basic user access", isActive: true },
  ]

  for (const r of data) {
    await prisma.role.upsert({
      where: { name: r.name },
      update: { description: r.description },
      create: r,
    })
  }

  return prisma.role.findMany()
}

// ---------------------------------------------------------------------------
// 2b. Role hierarchy (parent relationships)
// ---------------------------------------------------------------------------

async function assignRoleHierarchy(roles: Role[]): Promise<void> {
  // Hierarchy: SuperAdmin ← Admin ← Manager ← User
  // Each role inherits permissions from its parent (the role above it)
  const roleByName = new Map(roles.map((r) => [r.name, r]))

  const hierarchy = [
    { child: "Admin", parent: "SuperAdmin" },
    { child: "Manager", parent: "Admin" },
    { child: "User", parent: "Manager" },
  ]

  for (const { child, parent } of hierarchy) {
    const childRole = roleByName.get(child)
    const parentRole = roleByName.get(parent)
    if (childRole && parentRole) {
      await prisma.role.update({
        where: { id: childRole.id },
        data: { parentId: parentRole.id },
      })
    }
  }
}

// ---------------------------------------------------------------------------
// 3. Role -> Permission assignments
// ---------------------------------------------------------------------------

async function assignPermissionsToRoles(
  roles: Role[],
  permissions: Permission[]
): Promise<void> {
  const adminRole = roles.find((r) => r.name === "Admin")!
  const managerRole = roles.find((r) => r.name === "Manager")!
  const userRole = roles.find((r) => r.name === "User")!

  const adminPerms = permissions.filter(
    (p) =>
      (p.resource === "USER" && p.action !== "DELETE") ||
      p.resource === "PROFILE" ||
      (p.resource === "ROLE" && p.action === "READ") ||
      p.resource === "PERMISSION" ||
      p.resource === "ADMIN_DASHBOARD" ||
      p.resource === "URL" ||
      p.resource === "API_KEY" ||
      (p.resource === "AUDIT_LOG" &&
        (p.action === "READ" || p.action === "LIST")) ||
      (p.resource === "REPORT" &&
        (p.action === "READ" || p.action === "LIST")) ||
      p.resource === "TAG" ||
      p.resource === "ANALYTICS"
  )

  const managerPerms = permissions.filter(
    (p) =>
      (p.resource === "USER" && (p.action === "READ" || p.action === "LIST")) ||
      p.resource === "PROFILE" ||
      (p.resource === "ADMIN_DASHBOARD" && p.action === "READ")
  )

  const userPerms = permissions.filter(
    (p) =>
      (p.resource === "PROFILE" &&
        (p.action === "READ" || p.action === "UPDATE")) ||
      (p.resource === "URL" &&
        (p.action === "CREATE" ||
          p.action === "READ" ||
          p.action === "UPDATE" ||
          p.action === "DELETE" ||
          p.action === "LIST")) ||
      (p.resource === "TAG" &&
        (p.action === "CREATE" ||
          p.action === "READ" ||
          p.action === "UPDATE" ||
          p.action === "DELETE" ||
          p.action === "LIST")) ||
      (p.resource === "API_KEY" &&
        (p.action === "CREATE" ||
          p.action === "READ" ||
          p.action === "UPDATE" ||
          p.action === "DELETE" ||
          p.action === "LIST")) ||
      (p.resource === "ANALYTICS" && p.action === "READ")
  )

  const rows = [
    ...adminPerms.map((p) => ({ roleId: adminRole.id, permissionId: p.id })),
    ...managerPerms.map((p) => ({
      roleId: managerRole.id,
      permissionId: p.id,
    })),
    ...userPerms.map((p) => ({ roleId: userRole.id, permissionId: p.id })),
  ]

  for (const row of rows) {
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: row },
      update: {},
      create: {
        role: { connect: { id: row.roleId } },
        permission: { connect: { id: row.permissionId } },
      },
    })
  }
}

// ---------------------------------------------------------------------------
// 4. Users  (4 system + 10 dummy = 14 total)
// ---------------------------------------------------------------------------

async function createUsers(): Promise<User[]> {
  const hash = (pw: string): Promise<string> => bcrypt.hash(pw, 10)

  const usersData: {
    email: string
    passwordHash: string
    fullName: string
    isActive: boolean
    isSuperAdmin: boolean
    plan: Plan
    monthlyUrlLimit: number
    monthlyClickLimit: number
  }[] = [
    // System accounts
    {
      email: "superadmin@example.com",
      passwordHash: await hash("SuperAdmin@123"),
      fullName: "Super Admin",
      isActive: true,
      isSuperAdmin: true,
      plan: "ENTERPRISE",
      monthlyUrlLimit: -1,
      monthlyClickLimit: -1,
    },
    {
      email: "admin@example.com",
      passwordHash: await hash("Admin@123"),
      fullName: "Admin User",
      isActive: true,
      isSuperAdmin: false,
      plan: "ENTERPRISE",
      monthlyUrlLimit: -1,
      monthlyClickLimit: -1,
    },
    {
      email: "manager@example.com",
      passwordHash: await hash("Manager@123"),
      fullName: "Manager User",
      isActive: true,
      isSuperAdmin: false,
      plan: "PRO",
      monthlyUrlLimit: 500,
      monthlyClickLimit: 100_000,
    },
    {
      email: "user@example.com",
      passwordHash: await hash("User@123"),
      fullName: "Regular User",
      isActive: true,
      isSuperAdmin: false,
      plan: "FREE",
      monthlyUrlLimit: 50,
      monthlyClickLimit: 10_000,
    },

    // Dummy users
    {
      email: "alice.johnson@example.com",
      passwordHash: await hash("Alice@123"),
      fullName: "Alice Johnson",
      isActive: true,
      isSuperAdmin: false,
      plan: "PRO",
      monthlyUrlLimit: 500,
      monthlyClickLimit: 100_000,
    },
    {
      email: "bob.smith@example.com",
      passwordHash: await hash("Bob@123"),
      fullName: "Bob Smith",
      isActive: true,
      isSuperAdmin: false,
      plan: "PRO",
      monthlyUrlLimit: 500,
      monthlyClickLimit: 100_000,
    },
    {
      email: "carol.white@example.com",
      passwordHash: await hash("Carol@123"),
      fullName: "Carol White",
      isActive: true,
      isSuperAdmin: false,
      plan: "FREE",
      monthlyUrlLimit: 50,
      monthlyClickLimit: 10_000,
    },
    {
      email: "david.lee@example.com",
      passwordHash: await hash("David@123"),
      fullName: "David Lee",
      isActive: true,
      isSuperAdmin: false,
      plan: "PRO",
      monthlyUrlLimit: 500,
      monthlyClickLimit: 100_000,
    },
    {
      email: "eve.davis@example.com",
      passwordHash: await hash("Eve@123"),
      fullName: "Eve Davis",
      isActive: false,
      isSuperAdmin: false, // deactivated
      plan: "FREE",
      monthlyUrlLimit: 50,
      monthlyClickLimit: 10_000,
    },
    {
      email: "frank.miller@example.com",
      passwordHash: await hash("Frank@123"),
      fullName: "Frank Miller",
      isActive: true,
      isSuperAdmin: false,
      plan: "ENTERPRISE",
      monthlyUrlLimit: -1,
      monthlyClickLimit: -1,
    },
    {
      email: "grace.wilson@example.com",
      passwordHash: await hash("Grace@123"),
      fullName: "Grace Wilson",
      isActive: true,
      isSuperAdmin: false,
      plan: "FREE",
      monthlyUrlLimit: 50,
      monthlyClickLimit: 10_000,
    },
    {
      email: "henry.moore@example.com",
      passwordHash: await hash("Henry@123"),
      fullName: "Henry Moore",
      isActive: true,
      isSuperAdmin: false,
      plan: "PRO",
      monthlyUrlLimit: 500,
      monthlyClickLimit: 100_000,
    },
    {
      email: "isla.taylor@example.com",
      passwordHash: await hash("Isla@123"),
      fullName: "Isla Taylor",
      isActive: true,
      isSuperAdmin: false,
      plan: "FREE",
      monthlyUrlLimit: 50,
      monthlyClickLimit: 10_000,
    },
    {
      email: "jack.anderson@example.com",
      passwordHash: await hash("Jack@123"),
      fullName: "Jack Anderson",
      isActive: true,
      isSuperAdmin: false,
      plan: "PRO",
      monthlyUrlLimit: 500,
      monthlyClickLimit: 100_000,
    },
  ]

  const users: User[] = []
  for (const u of usersData) {
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: {
        fullName: u.fullName,
        isActive: u.isActive,
        plan: u.plan ?? "FREE",
      },
      create: u,
    })
    users.push(user)
  }
  return users
}

// ---------------------------------------------------------------------------
// 5. User -> Role assignments
// ---------------------------------------------------------------------------

async function assignRolesToUsers(users: User[], roles: Role[]): Promise<void> {
  const get = (email: string) => users.find((u) => u.email === email)!
  const role = (name: string) => roles.find((r) => r.name === name)!

  const assignments = [
    { user: get("superadmin@example.com"), role: role("SuperAdmin") },
    { user: get("admin@example.com"), role: role("Admin") },
    { user: get("manager@example.com"), role: role("Manager") },
    { user: get("user@example.com"), role: role("User") },
    { user: get("alice.johnson@example.com"), role: role("User") },
    { user: get("bob.smith@example.com"), role: role("User") },
    { user: get("carol.white@example.com"), role: role("User") },
    { user: get("david.lee@example.com"), role: role("Manager") },
    { user: get("eve.davis@example.com"), role: role("User") },
    { user: get("frank.miller@example.com"), role: role("Admin") },
    { user: get("grace.wilson@example.com"), role: role("User") },
    { user: get("henry.moore@example.com"), role: role("User") },
    { user: get("isla.taylor@example.com"), role: role("User") },
    { user: get("jack.anderson@example.com"), role: role("User") },
  ]

  for (const a of assignments) {
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: a.user.id, roleId: a.role.id } },
      update: {},
      create: {
        user: { connect: { id: a.user.id } },
        role: { connect: { id: a.role.id } },
      },
    })
  }
}

// ---------------------------------------------------------------------------
// 6. User-level permission overrides
// ---------------------------------------------------------------------------

async function assignAdditionalPermissions(
  users: User[],
  permissions: Permission[]
): Promise<void> {
  const get = (email: string) => users.find((u) => u.email === email)!
  const perm = (action: PermissionAction, resource: PermissionResource) =>
    permissions.find((p) => p.action === action && p.resource === resource)!

  const overrides = [
    { user: get("admin@example.com"), permission: perm("DELETE", "USER") },
    { user: get("manager@example.com"), permission: perm("UPDATE", "USER") },
    {
      user: get("frank.miller@example.com"),
      permission: perm("MANAGE", "SYSTEM_SETTINGS"),
    },
    { user: get("david.lee@example.com"), permission: perm("LIST", "USER") },
  ]

  for (const o of overrides) {
    await prisma.userPermission.upsert({
      where: {
        userId_permissionId: {
          userId: o.user.id,
          permissionId: o.permission.id,
        },
      },
      update: {},
      create: {
        user: { connect: { id: o.user.id } },
        permission: { connect: { id: o.permission.id } },
      },
    })
  }
}

// ---------------------------------------------------------------------------
// 7. Refresh tokens  (2 per active user)
// ---------------------------------------------------------------------------

async function createRefreshTokens(users: User[]): Promise<void> {
  const activeUsers = users.filter((u) => u.isActive)
  for (const u of activeUsers) {
    await prisma.refreshToken.createMany({
      data: [
        {
          userId: u.id,
          token: `rt_${u.id}_desktop_${Date.now()}`,
          deviceInfo: rand([
            "Chrome on Windows",
            "Safari on macOS",
            "Firefox on Linux",
          ]),
          ipAddress: `${randInt(1, 254)}.${randInt(0, 255)}.${randInt(0, 255)}.${randInt(1, 254)}`,
          expiresAt: daysFromNow(7),
        },
        {
          userId: u.id,
          token: `rt_${u.id}_mobile_${Date.now() + 1}`,
          deviceInfo: rand([
            "Chrome on Android",
            "Safari on iOS",
            "Samsung Internet",
          ]),
          ipAddress: `${randInt(1, 254)}.${randInt(0, 255)}.${randInt(0, 255)}.${randInt(1, 254)}`,
          expiresAt: daysFromNow(30),
        },
      ],
    })
  }
}

// ---------------------------------------------------------------------------
// 8. Tags  (~27 rows)
// ---------------------------------------------------------------------------

async function createTags(users: User[]): Promise<Tag[]> {
  const get = (email: string) => users.find((u) => u.email === email)!

  const tagsData = [
    // Alice
    {
      userId: get("alice.johnson@example.com").id,
      name: "marketing",
      color: "#6366f1",
    },
    {
      userId: get("alice.johnson@example.com").id,
      name: "social",
      color: "#ec4899",
    },
    {
      userId: get("alice.johnson@example.com").id,
      name: "docs",
      color: "#10b981",
    },
    {
      userId: get("alice.johnson@example.com").id,
      name: "campaigns",
      color: "#f59e0b",
    },
    // Bob
    { userId: get("bob.smith@example.com").id, name: "work", color: "#3b82f6" },
    {
      userId: get("bob.smith@example.com").id,
      name: "personal",
      color: "#8b5cf6",
    },
    {
      userId: get("bob.smith@example.com").id,
      name: "portfolio",
      color: "#14b8a6",
    },
    // Carol
    {
      userId: get("carol.white@example.com").id,
      name: "blog",
      color: "#f43f5e",
    },
    {
      userId: get("carol.white@example.com").id,
      name: "recipes",
      color: "#22c55e",
    },
    // David
    { userId: get("david.lee@example.com").id, name: "dev", color: "#0ea5e9" },
    {
      userId: get("david.lee@example.com").id,
      name: "tools",
      color: "#a855f7",
    },
    {
      userId: get("david.lee@example.com").id,
      name: "open-source",
      color: "#f97316",
    },
    // Frank
    {
      userId: get("frank.miller@example.com").id,
      name: "internal",
      color: "#64748b",
    },
    {
      userId: get("frank.miller@example.com").id,
      name: "ops",
      color: "#dc2626",
    },
    {
      userId: get("frank.miller@example.com").id,
      name: "infra",
      color: "#7c3aed",
    },
    // Grace
    {
      userId: get("grace.wilson@example.com").id,
      name: "art",
      color: "#db2777",
    },
    {
      userId: get("grace.wilson@example.com").id,
      name: "shop",
      color: "#16a34a",
    },
    // Henry
    {
      userId: get("henry.moore@example.com").id,
      name: "finance",
      color: "#ca8a04",
    },
    {
      userId: get("henry.moore@example.com").id,
      name: "news",
      color: "#0891b2",
    },
    {
      userId: get("henry.moore@example.com").id,
      name: "research",
      color: "#9333ea",
    },
    // Isla
    {
      userId: get("isla.taylor@example.com").id,
      name: "travel",
      color: "#0d9488",
    },
    {
      userId: get("isla.taylor@example.com").id,
      name: "photos",
      color: "#e11d48",
    },
    // Jack
    {
      userId: get("jack.anderson@example.com").id,
      name: "saas",
      color: "#2563eb",
    },
    {
      userId: get("jack.anderson@example.com").id,
      name: "startup",
      color: "#7c3aed",
    },
    {
      userId: get("jack.anderson@example.com").id,
      name: "growth",
      color: "#059669",
    },
    // Admin
    { userId: get("admin@example.com").id, name: "internal", color: "#475569" },
    {
      userId: get("admin@example.com").id,
      name: "monitoring",
      color: "#b91c1c",
    },
  ]

  await prisma.tag.createMany({ data: tagsData, skipDuplicates: true })
  return prisma.tag.findMany()
}

// ---------------------------------------------------------------------------
// 9. URLs  (40 rows)
// ---------------------------------------------------------------------------

async function createUrls(users: User[]): Promise<Url[]> {
  const get = (email: string) => users.find((u) => u.email === email)!

  const urlsData: {
    userId: string | null
    shortCode: string
    customAlias?: string
    originalUrl: string
    title: string | null
    redirectType: RedirectType
    isActive: boolean
    clickCount: number
    clickLimit?: number
    expiresAt?: Date
  }[] = [
    // Alice
    {
      userId: get("alice.johnson@example.com").id,
      shortCode: "ali-gh",
      originalUrl: "https://github.com/alicejohnson",
      title: "Alice's GitHub",
      redirectType: "TEMPORARY",
      isActive: true,
      clickCount: 284,
    },
    {
      userId: get("alice.johnson@example.com").id,
      shortCode: "ali-tw",
      customAlias: "alice-twitter",
      originalUrl: "https://twitter.com/alice_codes",
      title: "Alice on Twitter",
      redirectType: "TEMPORARY",
      isActive: true,
      clickCount: 173,
    },
    {
      userId: get("alice.johnson@example.com").id,
      shortCode: "ali-yt",
      originalUrl: "https://youtube.com/@alicecodes",
      title: "Alice's YouTube Channel",
      redirectType: "TEMPORARY",
      isActive: true,
      clickCount: 512,
    },
    {
      userId: get("alice.johnson@example.com").id,
      shortCode: "q1-promo",
      customAlias: "promo-q1",
      originalUrl: "https://shop.example.com/promo?campaign=q1_2025",
      title: "Q1 2025 Promo Campaign",
      redirectType: "TEMPORARY",
      isActive: false,
      clickCount: 1840,
      expiresAt: new Date("2025-03-31"),
    },
    {
      userId: get("alice.johnson@example.com").id,
      shortCode: "ali-nl",
      originalUrl: "https://newsletter.alice.dev/subscribe",
      title: "Alice's Newsletter",
      redirectType: "TEMPORARY",
      isActive: true,
      clickCount: 96,
      clickLimit: 1000,
    },
    {
      userId: get("alice.johnson@example.com").id,
      shortCode: "ali-lk",
      originalUrl: "https://linkedin.com/in/alicejohnson",
      title: "Alice on LinkedIn",
      redirectType: "TEMPORARY",
      isActive: true,
      clickCount: 45,
    },

    // Bob
    {
      userId: get("bob.smith@example.com").id,
      shortCode: "bob-lk",
      customAlias: "bob-linkedin",
      originalUrl: "https://linkedin.com/in/bobsmith",
      title: "Bob's LinkedIn",
      redirectType: "TEMPORARY",
      isActive: true,
      clickCount: 88,
    },
    {
      userId: get("bob.smith@example.com").id,
      shortCode: "bob-cal",
      originalUrl: "https://calendly.com/bobsmith/30min",
      title: "Book 30 min with Bob",
      redirectType: "TEMPORARY",
      isActive: true,
      clickCount: 47,
      clickLimit: 200,
    },
    {
      userId: get("bob.smith@example.com").id,
      shortCode: "bob-cv",
      customAlias: "bob-resume",
      originalUrl: "https://resume.bobsmith.dev",
      title: "Bob's Resume",
      redirectType: "PERMANENT",
      isActive: true,
      clickCount: 32,
    },
    {
      userId: get("bob.smith@example.com").id,
      shortCode: "bob-port",
      originalUrl: "https://bobsmith.dev",
      title: "Bob's Portfolio Site",
      redirectType: "PERMANENT",
      isActive: true,
      clickCount: 211,
    },

    // Carol
    {
      userId: get("carol.white@example.com").id,
      shortCode: "carol-blog",
      originalUrl: "https://carolwhite.blog",
      title: "Carol's Blog",
      redirectType: "TEMPORARY",
      isActive: true,
      clickCount: 634,
    },
    {
      userId: get("carol.white@example.com").id,
      shortCode: "carol-r1",
      originalUrl: "https://carolwhite.blog/recipes/pasta-carbonara",
      title: "Best Pasta Carbonara Recipe",
      redirectType: "TEMPORARY",
      isActive: true,
      clickCount: 291,
    },
    {
      userId: get("carol.white@example.com").id,
      shortCode: "carol-ig",
      originalUrl: "https://instagram.com/carolcooks",
      title: "Carol on Instagram",
      redirectType: "TEMPORARY",
      isActive: true,
      clickCount: 158,
    },

    // David
    {
      userId: get("david.lee@example.com").id,
      shortCode: "dav-gh",
      originalUrl: "https://github.com/davidlee",
      title: "David's GitHub",
      redirectType: "TEMPORARY",
      isActive: true,
      clickCount: 374,
    },
    {
      userId: get("david.lee@example.com").id,
      shortCode: "dav-npm",
      customAlias: "david-npm",
      originalUrl: "https://npmjs.com/~davidlee",
      title: "David's npm Packages",
      redirectType: "TEMPORARY",
      isActive: true,
      clickCount: 127,
    },
    {
      userId: get("david.lee@example.com").id,
      shortCode: "dav-oss",
      originalUrl: "https://github.com/davidlee/awesome-toolkit",
      title: "Awesome Toolkit — OSS",
      redirectType: "PERMANENT",
      isActive: true,
      clickCount: 892,
    },
    {
      userId: get("david.lee@example.com").id,
      shortCode: "dav-docs",
      originalUrl: "https://docs.awesome-toolkit.dev",
      title: "Toolkit Documentation",
      redirectType: "PERMANENT",
      isActive: true,
      clickCount: 440,
    },

    // Frank
    {
      userId: get("frank.miller@example.com").id,
      shortCode: "fk-dash",
      customAlias: "admin-dashboard",
      originalUrl: "https://internal.example.com/admin",
      title: "Admin Dashboard",
      redirectType: "TEMPORARY",
      isActive: true,
      clickCount: 1203,
    },
    {
      userId: get("frank.miller@example.com").id,
      shortCode: "fk-logs",
      originalUrl: "https://logs.internal.example.com",
      title: "Log Viewer",
      redirectType: "TEMPORARY",
      isActive: true,
      clickCount: 346,
    },
    {
      userId: get("frank.miller@example.com").id,
      shortCode: "fk-graf",
      originalUrl: "https://grafana.internal.example.com",
      title: "Grafana Monitoring",
      redirectType: "TEMPORARY",
      isActive: true,
      clickCount: 218,
    },
    {
      userId: get("frank.miller@example.com").id,
      shortCode: "fk-runbook",
      originalUrl: "https://notion.so/team/runbooks",
      title: "Ops Runbooks (Notion)",
      redirectType: "TEMPORARY",
      isActive: true,
      clickCount: 79,
    },

    // Grace
    {
      userId: get("grace.wilson@example.com").id,
      shortCode: "grace-shop",
      originalUrl: "https://etsy.com/shop/gracewilsonart",
      title: "Grace's Etsy Shop",
      redirectType: "TEMPORARY",
      isActive: true,
      clickCount: 502,
    },
    {
      userId: get("grace.wilson@example.com").id,
      shortCode: "grace-ig",
      customAlias: "grace-art",
      originalUrl: "https://instagram.com/gracewilsonart",
      title: "Grace's Art Instagram",
      redirectType: "TEMPORARY",
      isActive: true,
      clickCount: 739,
    },

    // Henry
    {
      userId: get("henry.moore@example.com").id,
      shortCode: "hen-sub",
      originalUrl: "https://substack.com/@henrymoore",
      title: "Henry's Substack",
      redirectType: "TEMPORARY",
      isActive: true,
      clickCount: 317,
    },
    {
      userId: get("henry.moore@example.com").id,
      shortCode: "hen-report",
      customAlias: "q4-report",
      originalUrl: "https://docs.example.com/reports/q4-2024-financial",
      title: "Q4 2024 Financial Report",
      redirectType: "PERMANENT",
      isActive: true,
      clickCount: 88,
    },
    {
      userId: get("henry.moore@example.com").id,
      shortCode: "hen-tw",
      originalUrl: "https://twitter.com/henrymoore_fin",
      title: "Henry on Twitter",
      redirectType: "TEMPORARY",
      isActive: true,
      clickCount: 64,
    },

    // Isla
    {
      userId: get("isla.taylor@example.com").id,
      shortCode: "isla-blog",
      originalUrl: "https://islatravels.com",
      title: "Isla's Travel Blog",
      redirectType: "TEMPORARY",
      isActive: true,
      clickCount: 428,
    },
    {
      userId: get("isla.taylor@example.com").id,
      shortCode: "isla-vsco",
      originalUrl: "https://vsco.co/islataylor",
      title: "Isla's VSCO",
      redirectType: "TEMPORARY",
      isActive: true,
      clickCount: 183,
    },

    // Jack
    {
      userId: get("jack.anderson@example.com").id,
      shortCode: "jack-app",
      customAlias: "launch",
      originalUrl: "https://app.jackstartup.com",
      title: "Jack's SaaS App",
      redirectType: "TEMPORARY",
      isActive: true,
      clickCount: 2104,
    },
    {
      userId: get("jack.anderson@example.com").id,
      shortCode: "jack-ph",
      originalUrl: "https://producthunt.com/posts/jackstartup",
      title: "Product Hunt Launch",
      redirectType: "TEMPORARY",
      isActive: true,
      clickCount: 1567,
      expiresAt: daysFromNow(14),
    },
    {
      userId: get("jack.anderson@example.com").id,
      shortCode: "jack-demo",
      originalUrl: "https://app.jackstartup.com/demo",
      title: "Book a Demo",
      redirectType: "TEMPORARY",
      isActive: true,
      clickCount: 389,
      clickLimit: 500,
    },
    {
      userId: get("jack.anderson@example.com").id,
      shortCode: "jack-price",
      originalUrl: "https://app.jackstartup.com/pricing",
      title: "Pricing Page",
      redirectType: "TEMPORARY",
      isActive: true,
      clickCount: 874,
    },

    // Anonymous
    {
      userId: null,
      shortCode: "anon-1",
      originalUrl: "https://example.com/landing",
      title: null,
      redirectType: "TEMPORARY",
      isActive: true,
      clickCount: 12,
    },
    {
      userId: null,
      shortCode: "anon-2",
      originalUrl: "https://docs.example.com/getting-started",
      title: null,
      redirectType: "TEMPORARY",
      isActive: true,
      clickCount: 7,
    },
  ]

  await prisma.url.createMany({ data: urlsData, skipDuplicates: true })
  return prisma.url.findMany()
}

// ---------------------------------------------------------------------------
// 10. UrlTag join rows (~43 rows)
// ---------------------------------------------------------------------------

async function createUrlTags(
  users: User[],
  urls: Url[],
  tags: Tag[]
): Promise<void> {
  const u = (email: string) => users.find((x) => x.email === email)!
  const ul = (code: string) => urls.find((x) => x.shortCode === code)!
  const tg = (userId: string, name: string) =>
    tags.find((x) => x.userId === userId && x.name === name)!

  const alice = u("alice.johnson@example.com")
  const bob = u("bob.smith@example.com")
  const carol = u("carol.white@example.com")
  const david = u("david.lee@example.com")
  const frank = u("frank.miller@example.com")
  const grace = u("grace.wilson@example.com")
  const henry = u("henry.moore@example.com")
  const isla = u("isla.taylor@example.com")
  const jack = u("jack.anderson@example.com")

  const rows = [
    // Alice
    { urlId: ul("ali-gh").id, tagId: tg(alice.id, "social").id },
    { urlId: ul("ali-tw").id, tagId: tg(alice.id, "social").id },
    { urlId: ul("ali-yt").id, tagId: tg(alice.id, "social").id },
    { urlId: ul("q1-promo").id, tagId: tg(alice.id, "marketing").id },
    { urlId: ul("q1-promo").id, tagId: tg(alice.id, "campaigns").id },
    { urlId: ul("ali-nl").id, tagId: tg(alice.id, "marketing").id },
    { urlId: ul("ali-lk").id, tagId: tg(alice.id, "social").id },

    // Bob
    { urlId: ul("bob-lk").id, tagId: tg(bob.id, "work").id },
    { urlId: ul("bob-cal").id, tagId: tg(bob.id, "work").id },
    { urlId: ul("bob-cv").id, tagId: tg(bob.id, "portfolio").id },
    { urlId: ul("bob-port").id, tagId: tg(bob.id, "portfolio").id },

    // Carol
    { urlId: ul("carol-blog").id, tagId: tg(carol.id, "blog").id },
    { urlId: ul("carol-r1").id, tagId: tg(carol.id, "blog").id },
    { urlId: ul("carol-r1").id, tagId: tg(carol.id, "recipes").id },
    { urlId: ul("carol-ig").id, tagId: tg(carol.id, "blog").id },

    // David
    { urlId: ul("dav-gh").id, tagId: tg(david.id, "dev").id },
    { urlId: ul("dav-npm").id, tagId: tg(david.id, "dev").id },
    { urlId: ul("dav-oss").id, tagId: tg(david.id, "open-source").id },
    { urlId: ul("dav-oss").id, tagId: tg(david.id, "dev").id },
    { urlId: ul("dav-docs").id, tagId: tg(david.id, "tools").id },

    // Frank
    { urlId: ul("fk-dash").id, tagId: tg(frank.id, "internal").id },
    { urlId: ul("fk-logs").id, tagId: tg(frank.id, "ops").id },
    { urlId: ul("fk-graf").id, tagId: tg(frank.id, "infra").id },
    { urlId: ul("fk-graf").id, tagId: tg(frank.id, "ops").id },
    { urlId: ul("fk-runbook").id, tagId: tg(frank.id, "ops").id },

    // Grace
    { urlId: ul("grace-shop").id, tagId: tg(grace.id, "shop").id },
    { urlId: ul("grace-ig").id, tagId: tg(grace.id, "art").id },
    { urlId: ul("grace-ig").id, tagId: tg(grace.id, "shop").id },

    // Henry
    { urlId: ul("hen-sub").id, tagId: tg(henry.id, "finance").id },
    { urlId: ul("hen-sub").id, tagId: tg(henry.id, "news").id },
    { urlId: ul("hen-report").id, tagId: tg(henry.id, "finance").id },
    { urlId: ul("hen-report").id, tagId: tg(henry.id, "research").id },
    { urlId: ul("hen-tw").id, tagId: tg(henry.id, "news").id },

    // Isla
    { urlId: ul("isla-blog").id, tagId: tg(isla.id, "travel").id },
    { urlId: ul("isla-vsco").id, tagId: tg(isla.id, "photos").id },
    { urlId: ul("isla-vsco").id, tagId: tg(isla.id, "travel").id },

    // Jack
    { urlId: ul("jack-app").id, tagId: tg(jack.id, "saas").id },
    { urlId: ul("jack-app").id, tagId: tg(jack.id, "startup").id },
    { urlId: ul("jack-ph").id, tagId: tg(jack.id, "growth").id },
    { urlId: ul("jack-ph").id, tagId: tg(jack.id, "startup").id },
    { urlId: ul("jack-demo").id, tagId: tg(jack.id, "saas").id },
    { urlId: ul("jack-price").id, tagId: tg(jack.id, "growth").id },
  ]

  await prisma.urlTag.createMany({ data: rows, skipDuplicates: true })
}

// ---------------------------------------------------------------------------
// 11. Clicks  (~560 rows)
// ---------------------------------------------------------------------------

async function createClicks(urls: Url[]): Promise<void> {
  type ClickRow = {
    urlId: string
    ipAddress: string
    country: string
    city: string
    deviceType: DeviceType
    os: string
    browser: string
    referrer: string | null
    utmSource: string | null
    utmMedium: string | null
    utmCampaign: string | null
    clickedAt: Date
  }

  const ip = () =>
    `${randInt(1, 254)}.${randInt(0, 255)}.${randInt(0, 255)}.${randInt(1, 254)}`

  const makeClick = (
    urlId: string,
    daysBack: number,
    withUtm = false
  ): ClickRow => {
    const ci = randInt(0, COUNTRIES.length - 1)
    return {
      urlId,
      ipAddress: ip(),
      country: COUNTRIES[ci] ?? "MY",
      city: CITIES[ci] ?? "Kuala Lumpur",
      deviceType: rand(DEVICES),
      os: rand(OSS),
      browser: rand(BROWSERS),
      referrer: rand(REFERRERS),
      utmSource: withUtm ? rand(UTM_SOURCES) : null,
      utmMedium: withUtm ? rand(UTM_MEDIUMS) : null,
      utmCampaign: withUtm ? "seed_campaign" : null,
      clickedAt: daysAgo(daysBack),
    }
  }

  // [shortCode, clickCount, hasUtm]
  const targets: [string, number, boolean][] = [
    ["jack-app", 80, true],
    ["jack-ph", 60, true],
    ["jack-price", 40, true],
    ["jack-demo", 30, false],
    ["dav-oss", 40, false],
    ["dav-docs", 25, false],
    ["ali-yt", 30, false],
    ["q1-promo", 40, true],
    ["carol-blog", 35, false],
    ["grace-ig", 30, false],
    ["fk-dash", 25, false],
    ["ali-gh", 20, false],
    ["bob-port", 15, false],
    ["hen-sub", 15, false],
    ["isla-blog", 20, false],
    ["ali-nl", 10, true],
    ["carol-r1", 15, false],
    ["bob-lk", 10, false],
    ["dav-gh", 10, false],
    ["grace-shop", 10, false],
  ]

  const urlMap = new Map(urls.map((u) => [u.shortCode, u.id]))

  const rows: ClickRow[] = []
  for (const [code, count, withUtm] of targets) {
    const urlId = urlMap.get(code)
    if (!urlId) continue
    for (let i = 0; i < count; i++) {
      rows.push(makeClick(urlId, randInt(0, 90), withUtm))
    }
  }

  // Insert in batches of 100
  const BATCH = 100
  for (let i = 0; i < rows.length; i += BATCH) {
    await prisma.click.createMany({ data: rows.slice(i, i + BATCH) })
  }
}

// ---------------------------------------------------------------------------
// 12. API Keys  (17 rows — at least one per user)
// ---------------------------------------------------------------------------

/**
 * Charset for generating random API key segments (no ambiguous chars: 0/O, 1/l/I).
 * Matches the charset used in api-keys.service.ts for consistent key format.
 */
const API_KEY_CHARSET = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789"
const API_KEY_RANDOM_LENGTH = 25
const KEY_PREFIX_LENGTH = 14

/**
 * Generate a cryptographically random API key matching the service's format.
 * Returns { rawKey, keyPrefix }.
 * Format: sk_live_ + 25 random alphanumeric chars = 33 chars total.
 */
function generateSeedApiKey(): { rawKey: string; keyPrefix: string } {
  const bytes = crypto.randomBytes(API_KEY_RANDOM_LENGTH)
  let randomPart = ""
  for (let i = 0; i < API_KEY_RANDOM_LENGTH; i++) {
    const byteValue = bytes[i]
    if (byteValue !== undefined) {
      randomPart += API_KEY_CHARSET.charAt(byteValue % API_KEY_CHARSET.length)
    }
  }
  const rawKey = `sk_live_${randomPart}`
  const keyPrefix = rawKey.slice(0, KEY_PREFIX_LENGTH)
  return { rawKey, keyPrefix }
}

async function createApiKeys(users: User[]): Promise<void> {
  // NOTE: We do NOT delete existing keys here to preserve keys created by
  // generateAdditionalSeedData(). The skipDuplicates option on createMany
  // prevents hash conflicts since each key uses a unique random value.
  // For a full reset, use: npx prisma migrate reset

  const hash = (s: string): Promise<string> => bcrypt.hash(s, 10)
  const get = (email: string) => users.find((u) => u.email === email)!

  // Track raw keys to display to the tester
  const rawKeyLog: Array<{ email: string; name: string; rawKey: string }> = []

  const rows: Array<{
    userId: string
    name: string
    keyHash: string
    keyPrefix: string
    scopes: string[]
    rateLimitTier: string
    isActive: boolean
    expiresAt?: Date
  }> = []

  // Helper: generate a key row using random key + log the raw key for display
  const addKey = async (
    email: string,
    name: string,
    scopes: string[],
    tier: string,
    active: boolean,
    expiresAt?: Date
  ) => {
    const { rawKey, keyPrefix } = generateSeedApiKey()
    const keyHash = await hash(rawKey)
    rows.push({
      userId: get(email).id,
      name,
      keyHash,
      keyPrefix,
      scopes,
      rateLimitTier: tier,
      isActive: active,
      expiresAt,
    })
    rawKeyLog.push({ email, name, rawKey })
  }

  // ── SuperAdmin ────────────────────────────────────────────────────────
  await addKey(
    "superadmin@example.com",
    "SuperAdmin — Full Access",
    ["read", "write", "delete"],
    "enterprise",
    true
  )
  // ── Admin ─────────────────────────────────────────────────────────────
  await addKey(
    "admin@example.com",
    "Admin — Internal Key",
    ["read", "write", "delete"],
    "enterprise",
    true
  )
  await addKey(
    "admin@example.com",
    "Admin — Deprecated Key",
    ["read"],
    "enterprise",
    false,
    daysAgo(30)
  )
  // ── Manager ───────────────────────────────────────────────────────────
  await addKey(
    "manager@example.com",
    "Manager — Team API",
    ["read", "write"],
    "pro",
    true
  )
  // ── Regular User ──────────────────────────────────────────────────────
  await addKey(
    "user@example.com",
    "User — Personal Key",
    ["read"],
    "standard",
    true
  )
  // ── Alice ─────────────────────────────────────────────────────────────
  await addKey(
    "alice.johnson@example.com",
    "Alice — Production",
    ["read", "write"],
    "pro",
    true
  )
  await addKey(
    "alice.johnson@example.com",
    "Alice — CI/CD",
    ["read"],
    "pro",
    true,
    daysFromNow(90)
  )
  // ── Bob ───────────────────────────────────────────────────────────────
  await addKey(
    "bob.smith@example.com",
    "Bob — Personal",
    ["read"],
    "standard",
    true
  )
  // ── Carol ─────────────────────────────────────────────────────────────
  await addKey(
    "carol.white@example.com",
    "Carol — Blog API",
    ["read"],
    "standard",
    true
  )
  // ── David ─────────────────────────────────────────────────────────────
  await addKey(
    "david.lee@example.com",
    "David — OSS Toolkit",
    ["read", "write"],
    "pro",
    true
  )
  // ── Frank ─────────────────────────────────────────────────────────────
  await addKey(
    "frank.miller@example.com",
    "Frank — Internal Services",
    ["read", "write", "delete"],
    "enterprise",
    true
  )
  await addKey(
    "frank.miller@example.com",
    "Frank — Monitoring Bot",
    ["read"],
    "enterprise",
    true
  )
  // ── Grace ─────────────────────────────────────────────────────────────
  await addKey(
    "grace.wilson@example.com",
    "Grace — Art Portfolio",
    ["read"],
    "standard",
    true
  )
  // ── Henry ─────────────────────────────────────────────────────────────
  await addKey(
    "henry.moore@example.com",
    "Henry — Research Scripts",
    ["read"],
    "standard",
    true
  )
  // ── Isla ──────────────────────────────────────────────────────────────
  await addKey(
    "isla.taylor@example.com",
    "Isla — Travel API",
    ["read"],
    "standard",
    true
  )
  // ── Jack ──────────────────────────────────────────────────────────────
  await addKey(
    "jack.anderson@example.com",
    "Jack — SaaS Backend",
    ["read", "write"],
    "pro",
    true
  )
  await addKey(
    "jack.anderson@example.com",
    "Jack — Analytics Worker",
    ["read"],
    "pro",
    true
  )

  await prisma.apiKey.createMany({ data: rows, skipDuplicates: true })

  // ── Display generated keys so testers can use them ─────────────────────
  console.log("")
  console.log("  📋 Generated API Keys (use these for testing):")
  console.log("  ─────────────────────────────────────────────────────────")
  for (const entry of rawKeyLog) {
    console.log(`  ${entry.email.padEnd(35)} ${entry.rawKey}`)
  }
  console.log("")
}

// ---------------------------------------------------------------------------
// 12b. API Key Usage Logs — seed demo usage history for active API keys
// ---------------------------------------------------------------------------

async function createApiKeyUsageLogs(): Promise<void> {
  const apiKeys = await prisma.apiKey.findMany({
    where: { isActive: true },
    select: { id: true },
  })

  if (apiKeys.length === 0) return

  type UsageRow = {
    apiKeyId: string
    endpoint: string
    method: string
    statusCode: number
    ipAddress: string
    userAgent: string
    responseTimeMs: number
    createdAt: Date
  }

  const ip = () =>
    `${randInt(1, 254)}.${randInt(0, 255)}.${randInt(0, 255)}.${randInt(1, 254)}`
  const ENDPOINTS = [
    "/api/v1/urls",
    "/api/v1/urls/ali-gh",
    "/api/v1/tags",
    "/api/v1/analytics",
    "/api/v1/api-keys",
  ]
  const METHODS = ["GET", "POST", "PATCH", "DELETE"]
  const AGENTS = [
    "axios/1.7.0",
    "curl/8.4.0",
    "PostmanRuntime/7.36.0",
    "python-requests/2.31.0",
    "okhttp/4.12.0",
  ]
  const STATUSES = [
    200, 200, 200, 200, 201, 200, 200, 200, 404, 200, 200, 200, 200, 401, 200,
  ]

  const rows: UsageRow[] = []

  for (const key of apiKeys) {
    // Generate 10-25 random usage log entries per key over the last 30 days
    const entryCount = randInt(10, 25)
    for (let i = 0; i < entryCount; i++) {
      rows.push({
        apiKeyId: key.id,
        endpoint: rand(ENDPOINTS),
        method: rand(METHODS),
        statusCode: rand(STATUSES),
        ipAddress: ip(),
        userAgent: rand(AGENTS),
        responseTimeMs: randInt(15, 450),
        createdAt: daysAgo(randInt(1, 30)),
      })
    }
  }

  // Insert in batches of 50
  const BATCH = 50
  for (let i = 0; i < rows.length; i += BATCH) {
    await prisma.apiKeyUsageLog.createMany({
      data: rows.slice(i, i + BATCH),
      skipDuplicates: true,
    })
  }
}

// ---------------------------------------------------------------------------
// 12c. ABAC Demo — seed a condition on MANAGE:SYSTEM_SETTINGS
// ---------------------------------------------------------------------------
// This adds a runtime ABAC condition to the MANAGE:SYSTEM_SETTINGS permission.
// The condition requires that the authenticated user's email exists (which
// every authenticated user has). This demonstrates the ABAC evaluation
// pipeline in the PermissionsGuard without breaking existing functionality.
//
// To test: Log in as Frank Miller (frank.miller@example.com, Frank@123) who
// has MANAGE:SYSTEM_SETTINGS via direct grant. The guard will evaluate the
// condition {field: "user.email", operator: "exists", value: ""} at runtime.
// Since Frank has an email, the condition passes and he can access the resource.
//
// To see ABAC deny behavior: Change the condition via the PATCH API to one
// that fails, e.g.:
//   PATCH /rbac/permissions/<MANAGE:SYSTEM_SETTINGS's id>
//   Body: { "conditions": { "field": "extra.demoMode", "operator": "eq", "value": "enabled" } }
// Since extra is always {}, the condition fails and access is denied.

async function seedAbacConditions(permissions: Permission[]): Promise<void> {
  const manageSystemSettings = permissions.find(
    (p) => p.action === "MANAGE" && p.resource === "SYSTEM_SETTINGS"
  )
  if (!manageSystemSettings) return

  // Condition: user.email must exist (always passes for authenticated users)
  const abacCondition = {
    field: "user.email",
    operator: "exists",
    value: "",
  }

  await prisma.permission.update({
    where: { id: manageSystemSettings.id },
    data: { conditions: abacCondition },
  })

  console.log(
    `  ABAC demo: Set condition on MANAGE:SYSTEM_SETTINGS → ${JSON.stringify(abacCondition)}`
  )
}

// ---------------------------------------------------------------------------
// 12d. Password Reset Tokens — seed demo tokens for active users
// ---------------------------------------------------------------------------

async function createPasswordResetTokens(users: User[]): Promise<void> {
  const hash = (s: string): Promise<string> => bcrypt.hash(s, 10)
  const activeUsers = users.filter((u) => u.isActive)

  const rows: Array<{
    userId: string
    token: string
    expiresAt: Date
  }> = []

  // Create 3 pending tokens for different users
  const pendingRequests: Array<{ email: string }> = [
    { email: "user@example.com" },
    { email: "alice.johnson@example.com" },
    { email: "henry.moore@example.com" },
  ]

  for (const { email } of pendingRequests) {
    const user = activeUsers.find((u) => u.email === email)
    if (!user) continue
    const rawToken = crypto.randomBytes(32).toString("hex")
    const tokenHash = await hash(rawToken)
    rows.push({
      userId: user.id,
      token: tokenHash,
      expiresAt: daysFromNow(1), // valid for 1 day
    })
  }

  // Create 1 expired token (used/past expiry)
  const expiredUser = activeUsers.find(
    (u) => u.email === "carol.white@example.com"
  )
  if (expiredUser) {
    const rawToken = crypto.randomBytes(32).toString("hex")
    const tokenHash = await hash(rawToken)
    rows.push({
      userId: expiredUser.id,
      token: tokenHash,
      expiresAt: daysAgo(2), // expired 2 days ago
    })
  }

  if (rows.length > 0) {
    await prisma.passwordResetToken.createMany({
      data: rows,
      skipDuplicates: true,
    })
  }
}

// ---------------------------------------------------------------------------
// 13. Menu Items (sidebar navigation)
// ---------------------------------------------------------------------------

async function createMenuItems(
  permissions: Permission[],
  roles: Role[]
): Promise<void> {
  const perm = (action: PermissionAction, resource: PermissionResource) =>
    permissions.find((p) => p.action === action && p.resource === resource)!
  const role = (name: string) => roles.find((r) => r.name === name)!

  // ── 13a. Create menu items ──────────────────────────────────────────

  const menuData: {
    name: string
    label?: string
    icon: string
    path: string | null
    parentName?: string
    order: number
  }[] = [
    // ── Main navigation — visible to all authenticated users ──────────
    {
      name: "Dashboard",
      icon: "LayoutDashboard",
      path: "/dashboard",
      order: 0,
    },
    { name: "Links", icon: "Link", path: "/urls", order: 1 },
    { name: "Analytics", icon: "BarChart3", path: "/analytics", order: 2 },
    { name: "Tags", icon: "Tags", path: "/tags", order: 3 },
    { name: "API Keys", icon: "Key", path: "/api-keys", order: 4 },
    { name: "Profile", icon: "User", path: "/profile", order: 5 },

    // ── Administration (Level 1, parent) ─────────────────────────────
    { name: "Administration", icon: "Shield", path: null, order: 6 },

    // ── Level 2: Administration children ─────────────────────────────
    {
      name: "Users",
      icon: "Users",
      path: "/admin/users",
      parentName: "Administration",
      order: 0,
    },
    {
      name: "Roles",
      icon: "UserCog",
      path: "/admin/roles",
      parentName: "Administration",
      order: 1,
    },
    {
      name: "Permissions",
      icon: "KeyRound",
      path: "/admin/permissions",
      parentName: "Administration",
      order: 2,
    },
    {
      name: "RBAC",
      icon: "Lock",
      path: "/admin/rbac",
      parentName: "Administration",
      order: 3,
    },
    {
      name: "All URLs",
      icon: "Globe",
      path: "/admin/urls",
      parentName: "Administration",
      order: 4,
    },
    {
      name: "All API Keys",
      icon: "KeyRound",
      path: "/admin/api-keys",
      parentName: "Administration",
      order: 5,
    },

    // ── Level 3: Users children ─────────────────────────────────────
    {
      name: "All Users",
      icon: "List",
      path: "/admin/users/all",
      parentName: "Users",
      order: 0,
    },
    {
      name: "User Groups",
      icon: "UsersRound",
      path: "/admin/users/groups",
      parentName: "Users",
      order: 1,
    },
    {
      name: "User Activity",
      icon: "Activity",
      path: "/admin/users/activity",
      parentName: "Users",
      order: 2,
    },

    // ── Level 3: Roles children ─────────────────────────────────────
    {
      name: "Role Templates",
      icon: "FileText",
      path: "/admin/roles/templates",
      parentName: "Roles",
      order: 0,
    },
    {
      name: "Role Matrix",
      icon: "GitBranch",
      path: "/admin/roles/matrix",
      parentName: "Roles",
      order: 1,
    },

    // ── Level 3: Permissions children ───────────────────────────────
    {
      name: "Permission Matrix",
      icon: "Table",
      path: "/admin/permissions/matrix",
      parentName: "Permissions",
      order: 0,
    },
    {
      name: "Audit Trail",
      icon: "Scroll",
      path: "/admin/permissions/audit",
      parentName: "Permissions",
      order: 1,
    },

    // ── System (Level 1, parent) ─────────────────────────────────────
    {
      name: "System",
      label: "System Settings",
      icon: "Settings",
      path: null,
      order: 7,
    },

    // ── Level 2: System children ────────────────────────────────────
    {
      name: "Settings",
      icon: "Sliders",
      path: "/admin/settings",
      parentName: "System",
      order: 0,
    },
    {
      name: "Health",
      icon: "HeartPulse",
      path: "/admin/health",
      parentName: "System",
      order: 1,
    },
    {
      name: "Audit Logs",
      icon: "ScrollText",
      path: "/admin/audit-logs",
      parentName: "System",
      order: 2,
    },
    {
      name: "Reports",
      icon: "FileBarChart",
      path: "/admin/reports",
      parentName: "System",
      order: 3,
    },

    // ── Level 3: Settings children ──────────────────────────────────
    {
      name: "General",
      icon: "Settings2",
      path: "/admin/settings/general",
      parentName: "Settings",
      order: 0,
    },
    {
      name: "Security",
      icon: "ShieldAlert",
      path: "/admin/settings/security",
      parentName: "Settings",
      order: 1,
    },
    {
      name: "Email",
      icon: "Mail",
      path: "/admin/settings/email",
      parentName: "Settings",
      order: 2,
    },
    {
      name: "Notifications",
      icon: "Bell",
      path: "/admin/settings/notifications",
      parentName: "Settings",
      order: 3,
    },
    {
      name: "Localization",
      icon: "Languages",
      path: "/admin/settings/localization",
      parentName: "Settings",
      order: 4,
    },

    // ── Level 4: Security children ──────────────────────────────────
    {
      name: "Password Policy",
      icon: "KeyRound",
      path: "/admin/settings/security/password-policy",
      parentName: "Security",
      order: 0,
    },
    {
      name: "Two-Factor Auth",
      icon: "ShieldCheck",
      path: "/admin/settings/security/2fa",
      parentName: "Security",
      order: 1,
    },
    {
      name: "IP Whitelist",
      icon: "ShieldHalf",
      path: "/admin/settings/security/ip-whitelist",
      parentName: "Security",
      order: 2,
    },
    {
      name: "Session Management",
      icon: "Monitor",
      path: "/admin/settings/security/sessions",
      parentName: "Security",
      order: 3,
    },

    // ── Level 5: Session Management children ────────────────────────
    {
      name: "Active Sessions",
      icon: "Activity",
      path: "/admin/settings/security/sessions/active",
      parentName: "Session Management",
      order: 0,
    },
    {
      name: "Session History",
      icon: "History",
      path: "/admin/settings/security/sessions/history",
      parentName: "Session Management",
      order: 1,
    },

    // ── Level 6: Active Sessions children (max depth demo) ──────────
    {
      name: "Force Logout",
      icon: "LogOut",
      path: "/admin/settings/security/sessions/active/force-logout",
      parentName: "Active Sessions",
      order: 0,
    },
    {
      name: "Session Inspector",
      icon: "Search",
      path: "/admin/settings/security/sessions/active/inspector",
      parentName: "Active Sessions",
      order: 1,
    },
    {
      name: "Login Activity",
      icon: "Clock",
      path: "/admin/settings/security/sessions/active/login-activity",
      parentName: "Active Sessions",
      order: 2,
    },

    // ── Level 6: Session History children ───────────────────────────
    {
      name: "Export Logs",
      icon: "Download",
      path: "/admin/settings/security/sessions/history/export",
      parentName: "Session History",
      order: 0,
    },
    {
      name: "Login Anomalies",
      icon: "AlertTriangle",
      path: "/admin/settings/security/sessions/history/anomalies",
      parentName: "Session History",
      order: 1,
    },

    // ── Level 3: Reports children ───────────────────────────────────
    {
      name: "Usage Reports",
      icon: "BarChart4",
      path: "/admin/reports/usage",
      parentName: "Reports",
      order: 0,
    },
    {
      name: "Revenue Reports",
      icon: "DollarSign",
      path: "/admin/reports/revenue",
      parentName: "Reports",
      order: 1,
    },
    {
      name: "User Reports",
      icon: "Users",
      path: "/admin/reports/users",
      parentName: "Reports",
      order: 2,
    },
    {
      name: "System Reports",
      icon: "Cpu",
      path: "/admin/reports/system",
      parentName: "Reports",
      order: 3,
    },

    // ── Content Management (Level 1, parent — fully mocked 6-level demo) ─
    { name: "Content Management", icon: "FileStack", path: null, order: 8 },

    // ── Level 2: Content Management children ─────────────────────────
    {
      name: "Media Library",
      icon: "Image",
      path: null,
      parentName: "Content Management",
      order: 0,
    },
    {
      name: "Pages",
      icon: "FileText",
      path: "/admin/content/pages",
      parentName: "Content Management",
      order: 1,
    },
    {
      name: "Blog",
      icon: "Feather",
      path: "/admin/content/blog",
      parentName: "Content Management",
      order: 2,
    },

    // ── Level 3: Media Library children ──────────────────────────────
    {
      name: "Images",
      icon: "ImagePlus",
      path: null,
      parentName: "Media Library",
      order: 0,
    },
    {
      name: "Videos",
      icon: "Video",
      path: "/admin/content/media/videos",
      parentName: "Media Library",
      order: 1,
    },
    {
      name: "Documents",
      icon: "File",
      path: "/admin/content/media/documents",
      parentName: "Media Library",
      order: 2,
    },

    // ── Level 4: Images children ─────────────────────────────────────
    {
      name: "Galleries",
      icon: "FolderOpen",
      path: null,
      parentName: "Images",
      order: 0,
    },
    {
      name: "Albums",
      icon: "Images",
      path: "/admin/content/media/images/albums",
      parentName: "Images",
      order: 1,
    },
    {
      name: "Uploads",
      icon: "Upload",
      path: "/admin/content/media/images/uploads",
      parentName: "Images",
      order: 2,
    },

    // ── Level 5: Galleries children ──────────────────────────────────
    {
      name: "Gallery Settings",
      icon: "Settings2",
      path: null,
      parentName: "Galleries",
      order: 0,
    },
    {
      name: "Gallery Tags",
      icon: "Tags",
      path: "/admin/content/media/images/galleries/tags",
      parentName: "Galleries",
      order: 1,
    },

    // ── Level 6: Gallery Settings children (max depth = 6) ───────────
    {
      name: "Display Options",
      icon: "Palette",
      path: "/admin/content/media/images/galleries/settings/display",
      parentName: "Gallery Settings",
      order: 0,
    },
    {
      name: "Gallery Permissions",
      icon: "Lock",
      path: "/admin/content/media/images/galleries/settings/permissions",
      parentName: "Gallery Settings",
      order: 1,
    },
    {
      name: "Watermarking",
      icon: "Droplets",
      path: "/admin/content/media/images/galleries/settings/watermark",
      parentName: "Gallery Settings",
      order: 2,
    },
  ]

  // Create or update menu items
  const menuItemMap = new Map<string, string>()
  for (const m of menuData) {
    const existing = await prisma.menuItem.findFirst({
      where: { name: m.name },
    })
    let item: MenuItem
    if (existing) {
      item = await prisma.menuItem.update({
        where: { id: existing.id },
        data: {
          icon: m.icon,
          path: m.path,
          order: m.order,
          isActive: true,
          label: m.label ?? existing.label,
        },
      })
    } else {
      item = await prisma.menuItem.create({
        data: {
          name: m.name,
          label: m.label,
          icon: m.icon,
          path: m.path,
          order: m.order,
          isActive: true,
        },
      })
    }
    menuItemMap.set(m.name, item.id)
  }

  // Set parent relationships — iterate through children to tie them to parents
  for (const m of menuData) {
    if (m.parentName) {
      const childId = menuItemMap.get(m.name)!
      const parentId = menuItemMap.get(m.parentName)!
      if (childId && parentId) {
        await prisma.menuItem.update({
          where: { id: childId },
          data: { parentId },
        })
      }
    }
  }

  // ── 13b. Role-based access ──────────────────────────────────────────

  const adminRole = role("Admin")
  const superAdminRole = role("SuperAdmin")

  // All admin gated items → Admin role
  const adminRoleItems = [
    "Administration",
    "Users",
    "Roles",
    "Permissions",
    "System",
    "Settings",
    "All URLs",
    "All API Keys",
    "Health",
    "Reports",
    "All Users",
    "User Groups",
    "User Activity",
    "Role Templates",
    "Role Matrix",
    "Permission Matrix",
    "Audit Trail",
    "General",
    "Security",
    "Email",
    "Notifications",
    "Localization",
    "Usage Reports",
    "Revenue Reports",
    "User Reports",
    "System Reports",
    "Content Management",
    "Media Library",
    "Pages",
    "Blog",
    "Images",
    "Videos",
    "Documents",
    "Galleries",
    "Albums",
    "Uploads",
    "Gallery Settings",
    "Gallery Tags",
    "Display Options",
    "Gallery Permissions",
    "Watermarking",
  ]
  for (const itemName of adminRoleItems) {
    const itemId = menuItemMap.get(itemName)
    if (itemId) {
      await prisma.menuItemRole.upsert({
        where: {
          menuItemId_roleId: { menuItemId: itemId, roleId: adminRole.id },
        },
        update: {},
        create: {
          menuItem: { connect: { id: itemId } },
          role: { connect: { id: adminRole.id } },
        },
      })
    }
  }

  // RBAC → SuperAdmin role (only super admins can manage RBAC)
  const rbacItemId = menuItemMap.get("RBAC")!
  await prisma.menuItemRole.upsert({
    where: {
      menuItemId_roleId: { menuItemId: rbacItemId, roleId: superAdminRole.id },
    },
    update: {},
    create: {
      menuItem: { connect: { id: rbacItemId } },
      role: { connect: { id: superAdminRole.id } },
    },
  })

  // Audit Logs → SuperAdmin role
  const auditLogsItemId = menuItemMap.get("Audit Logs")!
  await prisma.menuItemRole.upsert({
    where: {
      menuItemId_roleId: {
        menuItemId: auditLogsItemId,
        roleId: superAdminRole.id,
      },
    },
    update: {},
    create: {
      menuItem: { connect: { id: auditLogsItemId } },
      role: { connect: { id: superAdminRole.id } },
    },
  })

  // All API Keys → SuperAdmin role
  const allApiKeysItemId = menuItemMap.get("All API Keys")!
  await prisma.menuItemRole.upsert({
    where: {
      menuItemId_roleId: {
        menuItemId: allApiKeysItemId,
        roleId: superAdminRole.id,
      },
    },
    update: {},
    create: {
      menuItem: { connect: { id: allApiKeysItemId } },
      role: { connect: { id: superAdminRole.id } },
    },
  })

  // Deep security items → SuperAdmin role (Password Policy, Two-Factor Auth, IP Whitelist, Session Management, Active Sessions, Session History)
  const superAdminItems = [
    "Password Policy",
    "Two-Factor Auth",
    "IP Whitelist",
    "Session Management",
    "Active Sessions",
    "Session History",
    "Force Logout",
    "Session Inspector",
    "Login Activity",
    "Export Logs",
    "Login Anomalies",
  ]
  for (const itemName of superAdminItems) {
    const itemId = menuItemMap.get(itemName)
    if (itemId) {
      await prisma.menuItemRole.upsert({
        where: {
          menuItemId_roleId: { menuItemId: itemId, roleId: superAdminRole.id },
        },
        update: {},
        create: {
          menuItem: { connect: { id: itemId } },
          role: { connect: { id: superAdminRole.id } },
        },
      })
    }
  }

  // ── 13c. Permission-based access ─────────────────────────────────────

  // Dashboard has no permission/role requirements — visible to all authenticated users

  // Users hierarchy → LIST USER
  for (const itemName of [
    "Users",
    "All Users",
    "User Groups",
    "User Activity",
  ]) {
    const itemId = menuItemMap.get(itemName)
    if (itemId) {
      await prisma.menuItemPermission.upsert({
        where: {
          menuItemId_permissionId: {
            menuItemId: itemId,
            permissionId: perm("LIST", "USER").id,
          },
        },
        update: {},
        create: {
          menuItem: { connect: { id: itemId } },
          permission: { connect: { id: perm("LIST", "USER").id } },
          matchType: "ANY",
        },
      })
    }
  }

  // Roles hierarchy → LIST ROLE
  for (const itemName of ["Roles", "Role Templates", "Role Matrix"]) {
    const itemId = menuItemMap.get(itemName)
    if (itemId) {
      await prisma.menuItemPermission.upsert({
        where: {
          menuItemId_permissionId: {
            menuItemId: itemId,
            permissionId: perm("LIST", "ROLE").id,
          },
        },
        update: {},
        create: {
          menuItem: { connect: { id: itemId } },
          permission: { connect: { id: perm("LIST", "ROLE").id } },
          matchType: "ANY",
        },
      })
    }
  }

  // Permissions hierarchy → LIST PERMISSION
  for (const itemName of ["Permissions", "Permission Matrix", "Audit Trail"]) {
    const itemId = menuItemMap.get(itemName)
    if (itemId) {
      await prisma.menuItemPermission.upsert({
        where: {
          menuItemId_permissionId: {
            menuItemId: itemId,
            permissionId: perm("LIST", "PERMISSION").id,
          },
        },
        update: {},
        create: {
          menuItem: { connect: { id: itemId } },
          permission: { connect: { id: perm("LIST", "PERMISSION").id } },
          matchType: "ANY",
        },
      })
    }
  }

  // RBAC → MANAGE ROLE or MANAGE PERMISSION (match ANY)
  const manageRolePerm = perm("MANAGE", "ROLE")
  const managePermissionPerm = perm("MANAGE", "PERMISSION")

  for (const permItem of [manageRolePerm, managePermissionPerm]) {
    await prisma.menuItemPermission.upsert({
      where: {
        menuItemId_permissionId: {
          menuItemId: rbacItemId,
          permissionId: permItem.id,
        },
      },
      update: {},
      create: {
        menuItem: { connect: { id: rbacItemId } },
        permission: { connect: { id: permItem.id } },
        matchType: "ANY",
      },
    })
  }

  // Settings hierarchy → READ SYSTEM_SETTINGS
  for (const itemName of [
    "Settings",
    "General",
    "Email",
    "Notifications",
    "Localization",
  ]) {
    const itemId = menuItemMap.get(itemName)
    if (itemId) {
      await prisma.menuItemPermission.upsert({
        where: {
          menuItemId_permissionId: {
            menuItemId: itemId,
            permissionId: perm("READ", "SYSTEM_SETTINGS").id,
          },
        },
        update: {},
        create: {
          menuItem: { connect: { id: itemId } },
          permission: { connect: { id: perm("READ", "SYSTEM_SETTINGS").id } },
          matchType: "ANY",
        },
      })
    }
  }

  // Security hierarchy → MANAGE SYSTEM_SETTINGS
  for (const itemName of [
    "Security",
    "Password Policy",
    "Two-Factor Auth",
    "IP Whitelist",
    "Session Management",
    "Active Sessions",
    "Session History",
    "Force Logout",
    "Session Inspector",
    "Login Activity",
    "Export Logs",
    "Login Anomalies",
  ]) {
    const itemId = menuItemMap.get(itemName)
    if (itemId) {
      await prisma.menuItemPermission.upsert({
        where: {
          menuItemId_permissionId: {
            menuItemId: itemId,
            permissionId: perm("MANAGE", "SYSTEM_SETTINGS").id,
          },
        },
        update: {},
        create: {
          menuItem: { connect: { id: itemId } },
          permission: { connect: { id: perm("MANAGE", "SYSTEM_SETTINGS").id } },
          matchType: "ANY",
        },
      })
    }
  }

  // All URLs → LIST URL
  {
    const itemId = menuItemMap.get("All URLs")
    if (itemId) {
      await prisma.menuItemPermission.upsert({
        where: {
          menuItemId_permissionId: {
            menuItemId: itemId,
            permissionId: perm("LIST", "URL").id,
          },
        },
        update: {},
        create: {
          menuItem: { connect: { id: itemId } },
          permission: { connect: { id: perm("LIST", "URL").id } },
          matchType: "ANY",
        },
      })
    }
  }

  // All API Keys → LIST API_KEY
  {
    const itemId = menuItemMap.get("All API Keys")
    if (itemId) {
      await prisma.menuItemPermission.upsert({
        where: {
          menuItemId_permissionId: {
            menuItemId: itemId,
            permissionId: perm("LIST", "API_KEY").id,
          },
        },
        update: {},
        create: {
          menuItem: { connect: { id: itemId } },
          permission: { connect: { id: perm("LIST", "API_KEY").id } },
          matchType: "ANY",
        },
      })
    }
  }

  // Health → READ SYSTEM_SETTINGS
  {
    const itemId = menuItemMap.get("Health")
    if (itemId) {
      await prisma.menuItemPermission.upsert({
        where: {
          menuItemId_permissionId: {
            menuItemId: itemId,
            permissionId: perm("READ", "SYSTEM_SETTINGS").id,
          },
        },
        update: {},
        create: {
          menuItem: { connect: { id: itemId } },
          permission: { connect: { id: perm("READ", "SYSTEM_SETTINGS").id } },
          matchType: "ANY",
        },
      })
    }
  }

  // Audit Logs → LIST AUDIT_LOG
  {
    const itemId = menuItemMap.get("Audit Logs")
    if (itemId) {
      await prisma.menuItemPermission.upsert({
        where: {
          menuItemId_permissionId: {
            menuItemId: itemId,
            permissionId: perm("LIST", "AUDIT_LOG").id,
          },
        },
        update: {},
        create: {
          menuItem: { connect: { id: itemId } },
          permission: { connect: { id: perm("LIST", "AUDIT_LOG").id } },
          matchType: "ANY",
        },
      })
    }
  }

  // Reports hierarchy → LIST REPORT
  for (const itemName of [
    "Reports",
    "Usage Reports",
    "Revenue Reports",
    "User Reports",
    "System Reports",
  ]) {
    const itemId = menuItemMap.get(itemName)
    if (itemId) {
      await prisma.menuItemPermission.upsert({
        where: {
          menuItemId_permissionId: {
            menuItemId: itemId,
            permissionId: perm("LIST", "REPORT").id,
          },
        },
        update: {},
        create: {
          menuItem: { connect: { id: itemId } },
          permission: { connect: { id: perm("LIST", "REPORT").id } },
          matchType: "ANY",
        },
      })
    }
  }

  const count = await prisma.menuItem.count()
  console.log(`✅ ${count} menu items with role & permission assignments`)
}

// ---------------------------------------------------------------------------
// 14. Additional Seed Data (20 extra users with URLs, tags, clicks, and API keys)
// ---------------------------------------------------------------------------

async function generateAdditionalSeedData(
  roles: Role[],
  userRole: Role
): Promise<User[]> {
  const hash = (pw: string): Promise<string> => bcrypt.hash(pw, 10)
  const defaultPassword = await hash("User@123")

  const PLANS: Plan[] = ["FREE", "PRO"]
  const NAMES = [
    "Liam Smith",
    "Olivia Johnson",
    "Noah Davis",
    "Emma Brown",
    "Oliver Wilson",
    "Ava Taylor",
    "William Anderson",
    "Sophie Thomas",
    "James Jackson",
    "Mia White",
    "Benjamin Harris",
    "Charlotte Martin",
    "Lucas Thompson",
    "Amelia Garcia",
    "Henry Martinez",
    "Harper Robinson",
    "Alexander Clark",
    "Evelyn Rodriguez",
    "Daniel Lewis",
    "Abigail Lee",
  ]

  const createdUsers: User[] = []
  const urlList: Url[] = []
  const tagList: Tag[] = []
  const apiKeyRows: Array<{
    userId: string
    name: string
    keyHash: string
    keyPrefix: string
    scopes: string[]
    rateLimitTier: string
    isActive: boolean
    expiresAt?: Date
  }> = []
  const rawKeyLog: Array<{ email: string; rawKey: string }> = []

  for (const [i, name] of NAMES.entries()) {
    const email = `user-${String(i + 1).padStart(2, "0")}@example.com`
    const plan = rand(PLANS)
    const isActive = i < 17 // 3 inactive users

    const fullName = name
    const u = await prisma.user.upsert({
      where: { email },
      update: { fullName, isActive, plan },
      create: {
        email,
        passwordHash: defaultPassword,
        fullName,
        isActive,
        isSuperAdmin: false,
        plan,
        monthlyUrlLimit: plan === "PRO" ? 500 : 50,
        monthlyClickLimit: plan === "PRO" ? 100_000 : 10_000,
      },
    })
    createdUsers.push(u)

    // Assign User role
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: u.id, roleId: userRole.id } },
      update: {},
      create: { userId: u.id, roleId: userRole.id },
    })

    // Create refresh tokens (2 per user)
    await prisma.refreshToken.createMany({
      data: [
        {
          userId: u.id,
          token: `rt_${u.id}_d_${Date.now()}`,
          deviceInfo: "Chrome on Windows",
          ipAddress: `${randInt(1, 254)}.${randInt(0, 255)}.${randInt(0, 255)}.${randInt(1, 254)}`,
          expiresAt: daysFromNow(7),
        },
        {
          userId: u.id,
          token: `rt_${u.id}_m_${Date.now() + 1}`,
          deviceInfo: "Safari on iOS",
          ipAddress: `${randInt(1, 254)}.${randInt(0, 255)}.${randInt(0, 255)}.${randInt(1, 254)}`,
          expiresAt: daysFromNow(30),
        },
      ],
    })

    // Create 3-6 tags per user
    const tagNames = randInt(3, 6)
    const tagColors = [
      "#6366f1",
      "#ec4899",
      "#10b981",
      "#f59e0b",
      "#3b82f6",
      "#8b5cf6",
      "#14b8a6",
      "#f43f5e",
      "#22c55e",
      "#0ea5e9",
    ]
    const userTags: Tag[] = []
    for (let t = 0; t < tagNames; t++) {
      const tag = await prisma.tag.upsert({
        where: { userId_name: { userId: u.id, name: `tag-${i + 1}-${t}` } },
        update: {},
        create: {
          userId: u.id,
          name: `tag-${i + 1}-${t}`,
          color: rand(tagColors),
        },
      })
      userTags.push(tag)
    }
    tagList.push(...userTags)

    // Create 12-18 URLs per user
    const urlCount = randInt(12, 18)
    for (let uIdx = 0; uIdx < urlCount; uIdx++) {
      const shortCode = `usr${i + 1}-${uIdx}`
      const url = await prisma.url.upsert({
        where: { shortCode },
        update: {},
        create: {
          userId: u.id,
          shortCode,
          originalUrl: `https://example.com/user-${i + 1}/${uIdx}`,
          title: `User ${i + 1} — URL ${uIdx + 1}`,
          redirectType: "TEMPORARY",
          isActive: true,
          clickCount: randInt(0, 500),
          expiresAt:
            Math.random() > 0.8 ? daysFromNow(randInt(30, 90)) : undefined,
        },
      })
      urlList.push(url)

      // Link URL to a random tag
      if (userTags.length > 0) {
        const randomTag = rand(userTags)
        await prisma.urlTag
          .upsert({
            where: { urlId_tagId: { urlId: url.id, tagId: randomTag.id } },
            update: {},
            create: { urlId: url.id, tagId: randomTag.id },
          })
          .catch(() => {})
      }
    }

    // Generate 15-20 API keys per user with varied criteria
    const apiKeyCount = randInt(15, 20)
    const baseTier = plan === "PRO" ? "pro" : "standard"
    const allTiers: string[] = ["standard", "pro", "enterprise"]
    const allScopeSets: string[][] = [
      ["read"],
      ["read", "write"],
      ["read", "write", "delete"],
    ]
    for (let k = 0; k < apiKeyCount; k++) {
      const { rawKey, keyPrefix } = generateSeedApiKey()
      const keyHash = await bcrypt.hash(rawKey, 10)
      const scopes: string[] = cycle(allScopeSets, k)
      const tier = k < 5 ? baseTier : cycle(allTiers, k)
      const active = k < 12 ? isActive : false // last few are inactive
      const hasExpiry = k >= 10 && k < 14
      const name =
        k % 4 === 0
          ? `${fullName.split(" ")[0]} — API Key ${k + 1}`
          : k % 4 === 1
            ? `${fullName.split(" ")[0]} — Read-Only ${k + 1}`
            : k % 4 === 2
              ? `${fullName.split(" ")[0]} — Full Access ${k + 1}`
              : `${fullName.split(" ")[0]} — Dev Key ${k + 1}`
      apiKeyRows.push({
        userId: u.id,
        name,
        keyHash,
        keyPrefix,
        scopes,
        rateLimitTier: tier,
        isActive: active,
        expiresAt: hasExpiry ? daysFromNow(randInt(15, 90)) : undefined,
      })
      rawKeyLog.push({ email, rawKey })
    }
  }

  // Bulk insert API keys
  if (apiKeyRows.length > 0) {
    await prisma.apiKey.createMany({ data: apiKeyRows, skipDuplicates: true })
  }

  // ── Create 50 anonymous URLs (userId: null) for extra pagination data ─
  const ANONYMOUS_URL_COUNT = 50
  for (let a = 0; a < ANONYMOUS_URL_COUNT; a++) {
    const shortCode = `anon-bulk-${a}`
    const anonymousUrl = await prisma.url.upsert({
      where: { shortCode },
      update: {},
      create: {
        userId: null,
        shortCode,
        originalUrl: `https://example.com/anonymous/${a}`,
        title: Math.random() > 0.3 ? `Anonymous Page ${a + 1}` : null,
        redirectType: Math.random() > 0.5 ? "PERMANENT" : "TEMPORARY",
        isActive: true,
        clickCount: randInt(0, 300),
        expiresAt:
          Math.random() > 0.85 ? daysFromNow(randInt(30, 180)) : undefined,
      },
    })
    urlList.push(anonymousUrl)
  }

  // Create clicks for the new URLs
  if (urlList.length > 0) {
    const clickRows: Array<{
      urlId: string
      ipAddress: string
      country: string
      city: string
      deviceType: DeviceType
      os: string
      browser: string
      referrer: string | null
      utmSource: string | null
      utmMedium: string | null
      utmCampaign: string | null
      clickedAt: Date
    }> = []

    const ip = () =>
      `${randInt(1, 254)}.${randInt(0, 255)}.${randInt(0, 255)}.${randInt(1, 254)}`

    for (const url of urlList) {
      const extraClicks = randInt(5, 20)
      for (let c = 0; c < extraClicks; c++) {
        clickRows.push({
          urlId: url.id,
          ipAddress: ip(),
          country: rand(COUNTRIES),
          city: rand(CITIES),
          deviceType: rand(DEVICES),
          os: rand(OSS),
          browser: rand(BROWSERS),
          referrer: rand(REFERRERS),
          utmSource: Math.random() > 0.7 ? rand(UTM_SOURCES) : null,
          utmMedium: Math.random() > 0.7 ? rand(UTM_MEDIUMS) : null,
          utmCampaign: Math.random() > 0.7 ? "bulk_seed" : null,
          clickedAt: daysAgo(randInt(0, 60)),
        })
      }
    }

    // Insert clicks in batches
    const BATCH = 100
    for (let i = 0; i < clickRows.length; i += BATCH) {
      await prisma.click.createMany({ data: clickRows.slice(i, i + BATCH) })
    }
  }

  // Log generated API keys
  console.log("")
  console.log("  📋 Additional API Keys:")
  console.log("  ────────────────────────────────────────────────────────")
  for (const entry of rawKeyLog) {
    console.log(`  ${entry.email.padEnd(35)} ${entry.rawKey}`)
  }

  return createdUsers
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log("🌱 Starting seed...\n")

  console.log("Creating permissions...")
  const permissions = await createPermissions()
  console.log(`✅ ${permissions.length} permissions`)

  console.log("Creating roles...")
  const roles = await createRoles()
  console.log(`✅ ${roles.length} roles`)

  console.log("Assigning role hierarchy...")
  await assignRoleHierarchy(roles)
  console.log("✅ Role hierarchy assigned")

  console.log("Assigning permissions to roles...")
  await assignPermissionsToRoles(roles, permissions)
  console.log("✅ Role permissions assigned")

  console.log("Creating users...")
  const users = await createUsers()
  const userRole = roles.find((r) => r.name === "User")!
  const extraUsers = await generateAdditionalSeedData(roles, userRole)
  const allUsers = [...users, ...extraUsers]
  console.log(
    `✅ ${allUsers.length} users (${users.length} primary + ${extraUsers.length} additional)`
  )

  console.log("Assigning roles to users...")
  await assignRolesToUsers(users, roles)
  console.log("✅ User roles assigned")

  console.log("Assigning user-level permission overrides...")
  await assignAdditionalPermissions(users, permissions)
  console.log("✅ Permission overrides assigned")

  console.log("Creating refresh tokens...")
  await createRefreshTokens(allUsers)
  console.log("✅ Refresh tokens created")

  console.log("Creating tags...")
  const tags = await createTags(allUsers)
  console.log(`✅ ${tags.length} tags`)

  console.log("Creating URLs...")
  const urls = await createUrls(allUsers)
  console.log(`✅ ${urls.length} URLs`)

  console.log("Linking URL tags...")
  await createUrlTags(allUsers, urls, tags)
  console.log("✅ URL tags linked")

  console.log("Creating clicks...")
  await createClicks(urls)
  const clickCount = await prisma.click.count()
  console.log(`✅ ${clickCount} clicks`)

  console.log("Creating API keys...")
  await createApiKeys(allUsers)
  const keyCount = await prisma.apiKey.count()
  console.log(`✅ ${keyCount} API keys`)

  console.log("Seeding API key usage logs...")
  await createApiKeyUsageLogs()
  const usageLogCount = await prisma.apiKeyUsageLog.count()
  console.log(`✅ ${usageLogCount} API key usage log entries`)

  console.log("Creating menu items...")
  await createMenuItems(permissions, roles)
  const menuCount = await prisma.menuItem.count()
  console.log(`✅ ${menuCount} menu items`)

  console.log("Seeding ABAC demo conditions...")
  await seedAbacConditions(permissions)
  console.log(`✅ ABAC conditions seeded on MANAGE:SYSTEM_SETTINGS`)

  console.log("Creating password reset tokens...")
  await createPasswordResetTokens(users)
  const passwordResetCount = await prisma.passwordResetToken.count()
  console.log(`✅ ${passwordResetCount} password reset tokens`)

  console.log(`
🎉 Seed complete!

📋 Entity counts
──────────────────────────────────────────────
Permissions   : ${permissions.length}
Roles         : ${roles.length}
Users         : ${allUsers.length}
Tags          : ${tags.length}
URLs          : ${urls.length}
Clicks        : ${clickCount}
API Keys      : ${keyCount}
API Key Logs  : ${usageLogCount}
Reset Tokens  : ${passwordResetCount}
Menu Items    : ${menuCount}

👤 Test accounts
──────────────────────────────────────────────
superadmin@example.com    /  SuperAdmin@123  (isSuperAdmin · ENTERPRISE)
admin@example.com         /  Admin@123       (Admin role  · ENTERPRISE)
manager@example.com       /  Manager@123     (Manager role · PRO)
user@example.com          /  User@123        (User role · FREE)
alice.johnson@example.com /  Alice@123       (User role · PRO)
bob.smith@example.com     /  Bob@123         (User role · PRO)
carol.white@example.com   /  Carol@123       (User role · FREE)
david.lee@example.com     /  David@123       (Manager role · PRO)
eve.davis@example.com     /  Eve@123         (User role · FREE · INACTIVE)
frank.miller@example.com  /  Frank@123       (Admin role · ENTERPRISE)
grace.wilson@example.com  /  Grace@123       (User role · FREE)
henry.moore@example.com   /  Henry@123       (User role · PRO)
isla.taylor@example.com   /  Isla@123        (User role · FREE)
jack.anderson@example.com /  Jack@123        (User role · PRO)
`)
}

main()
  .catch((e: unknown) => {
    console.error("❌ Seed failed:", e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

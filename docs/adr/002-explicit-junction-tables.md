---
title: "ADR 002: Explicit Junction Tables for RBAC Relationships"
tags: ["adr", "database", "prisma", "rbac"]
description: "Architecture decision record for using explicit junction tables instead of Prisma implicit many-to-many."
author: "Backend Team"
lastUpdated: 1756003200000
coverImage: "https://images.unsplash.com/photo-1544383835-bda2bc66a55d?w=1200&h=630&fit=crop"
order: 2
---

# ADR 002: Explicit Junction Tables for RBAC Relationships

**Status:** Accepted  
**Date:** 2026-08-24  
**Deciders:** Backend Team

## Context

Prisma supports both implicit and explicit many-to-many relationships. For RBAC tables (UserRole, RolePermission, UserPermission), we need to decide which approach to use.

## Decision

Use **explicit junction tables** instead of Prisma's implicit many-to-many:

```prisma
model UserRole {
  userId    String
  roleId    String
  user      User       @relation(fields: [userId], references: [id], onDelete: Cascade)
  role      Role       @relation(fields: [roleId], references: [id], onDelete: Cascade)
  createdAt DateTime   @default(now())

  @@id([userId, roleId])
  @@index([roleId])
  @@map("user_roles")
}
```

## Consequences

### Positive
- **Composite uniqueness:** `@@id([userId, roleId])` enforces unique assignments
- **Metadata support:** Can add `assignedAt`, `assignedBy` fields later
- **Better indexes:** Explicit `@@index([roleId])` for efficient queries
- **Bulk operations:** `createMany({ skipDuplicates: true })` works cleanly
- **Cache invalidation:** Easy to query "all users with role X" for invalidation
- **Spatie compatibility:** Matches Laravel's underlying relationship model

### Negative
- **More code:** Explicit schema vs implicit auto-generated
- **Migration complexity:** Must create junction table manually

### Mitigations
- Schema is self-documenting (each field is explicit)
- Prisma Migrate handles junction tables automatically
- Seed scripts use `upsert` for idempotency

## Alternatives Considered

1. **Implicit many-to-many:** Simpler schema but no metadata, no custom indexes
2. **Single permissions array in User:** Doesn't scale, hard to query
3. **JSON column:** No referential integrity, hard to query

## References

- Prisma Explicit Many-to-Many: https://www.prisma.io/docs/concepts/components/prisma-schema/relations/many-to-many-relations
- Spatie Permission Tables: https://spatie.be/docs/laravel-permission/installation

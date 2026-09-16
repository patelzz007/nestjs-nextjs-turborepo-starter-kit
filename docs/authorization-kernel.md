# Authorization Kernel Architecture

## Overview

This project implements a comprehensive Authorization Kernel inspired by CASL, Oso, Cerbos, Permit.io, and OpenFGA concepts, without installing those products as dependencies. The architecture provides RBAC, ACL, policy-based authorization, ReBAC, and PostgreSQL RLS in a unified system.

## Core Principles

1. **Deny by Default**: Every layer denies by default
2. **Defense in Depth**: NestJS authorization + Prisma filters + PostgreSQL RLS
3. **No Arbitrary Code**: Policies use Zod-validated DSL, no JavaScript execution
4. **Strict TypeScript**: No `any`, `unknown`, `never`, or unsafe casts
5. **Audit Trail**: DENY always logged, WRITE always logged, sensitive READ optionally logged

## Architecture Layers

```text
                      REQUEST
                         │
                         ↓
                  Authentication
                         │
                         ↓
            Authorization Kernel
                         │
        ┌────────────────┼────────────────┐
        ↓                ↓                ↓
     RBAC              ACL            Policies
        │                │                │
        └────────────────┼────────────────┘
                         ↓
                  can() / filter()
                         ↓
                      Prisma
                         ↓
                 PostgreSQL RLS
                         ↓
                      Data
```

## Decision Precedence

Authorization decisions follow this precedence:

1. **SuperAdmin bypass** → ALLOW
2. **Explicit ACL DENY** → DENY (highest priority)
3. **Explicit ACL ALLOW** → ALLOW
4. **Role permissions** → ALLOW (if permission exists)
5. **Policy conditions** → ALLOW/DENY (ABAC evaluation)
6. **Ownership** → ALLOW (if user owns resource)
7. **Relationships** → ALLOW (via organization/location membership)
8. **Default** → DENY

## Core Components

### 1. AuthorizationKernelService

Main service providing:

- `can(request)`: Check authorization without throwing, returns decision with explanation
- `authorize(request)`: Enforce authorization, throws if denied
- `filter(context, action, resource)`: Generate Prisma WHERE filter for database-level filtering
- `explain(request)`: Detailed explanation of why a decision was made

### 2. PolicyEngineService

Evaluates Zod-validated policy DSL:

```json
{
  "all": [
    {
      "condition": {
        "field": "$user.organizationId",
        "operator": "equals",
        "valueRef": "$resource.organizationId"
      }
    },
    {
      "condition": {
        "field": "$resource.status",
        "operator": "not_equals",
        "value": "COMPLETED"
      }
    }
  ]
}
```

**Supported Operators**:
- Comparison: `equals`, `not_equals`, `in`, `not_in`
- String: `contains`, `not_contains`, `starts_with`, `ends_with`
- Numeric: `greater_than`, `greater_than_or_equals`, `less_than`, `less_than_or_equals`
- Existence: `exists`, `not_exists`

### 3. AclService

Manages resource-level ACL entries:

- Subject types: USER, ROLE
- Effects: ALLOW, DENY
- Scope: GLOBAL, ORGANIZATION, LOCATION, RESOURCE, OWN
- Expiration support
- Resource-specific or type-level ACLs

### 4. AuthorizationAuditKernelService

Records authorization decisions:

- Always logs DENY decisions
- Always logs WRITE operations (CREATE, UPDATE, DELETE, MANAGE)
- Optionally logs sensitive READ operations
- Never fails requests due to audit errors

## Database Schema

### ResourceAcl

Explicit ALLOW/DENY entries at the resource level:

```typescript
{
  subjectType: "USER" | "ROLE",
  subjectId: string,
  action: string,
  resourceType: string,
  resourceId?: string,
  effect: "ALLOW" | "DENY",
  scope?: PermissionScope,
  organizationId?: string,
  locationId?: string,
  conditions?: Json,
  expiresAt?: BigInt,
}
```

### PolicyDefinition

Zod-validated policy definitions:

```typescript
{
  name: string,
  version: number,
  effect: "ALLOW" | "DENY",
  scope: PermissionScope,
  actions: string[],
  resources: string[],
  organizationId?: string,
  conditions?: PolicyConditions,
  isActive: boolean,
}
```

### AuthorizationAudit

Comprehensive audit trail:

```typescript
{
  actorId?: string,
  organizationId?: string,
  action: string,
  resource: string,
  resourceId?: string,
  decision: "ALLOW" | "DENY",
  reason?: string,
  policyIds: string[],
  aclIds: string[],
  evaluation: Json,
  ipAddress?: string,
  durationMs?: number,
}
```

## Permission Scopes

- **GLOBAL**: Unrestricted access
- **ORGANIZATION**: Limited to user's organization
- **LOCATION**: Limited to user's location/store
- **RESOURCE**: Limited to specific resource ID
- **OWN**: Limited to resources owned by user

## Usage Examples

### Check Authorization

```typescript
const result = await authorizationKernel.can({
  subject: {
    userId: "user-123",
    organizationId: "org-456",
    isSuperAdmin: false,
  },
  action: "UPDATE",
  resource: "ORDER",
  resourceId: "order-789",
  resourceAttributes: {
    organizationId: "org-456",
    status: "PENDING",
  },
});

if (result.decision === "ALLOW") {
  // Proceed with action
} else {
  // Denied - result.evaluation contains explanation
}
```

### Enforce Authorization

```typescript
await authorizationKernel.authorize({
  subject: {
    userId: req.user.id,
    organizationId: req.user.organizationId,
  },
  action: "DELETE",
  resource: "ORDER",
  resourceId: orderId,
});
// Throws if denied
```

### Filter Query Results

```typescript
const where = await authorizationKernel.filter(
  {
    userId: req.user.id,
    organizationId: req.user.organizationId,
  },
  "READ",
  "ORDER"
);

const orders = await prisma.order.findMany({ where });
```

### Explain Decision

```typescript
const explanation = await authorizationKernel.explain(request);

console.log(explanation.decision); // "ALLOW" | "DENY"
console.log(explanation.evaluation); // Step-by-step reasoning
```

## RLS Integration

PostgreSQL RLS provides the final data-access boundary. The init migration includes:

- Role `app_runtime` (NOLOGIN, NOBYPASSRLS)
- Helper functions: `app_rls_bypass()`, `app_current_user_id()`, `app_current_organization_id()`, `app_owns()`
- Policies for all tables
- Transaction-local context via `set_config(..., true)`

**No separate `db:rls` command is needed** - RLS is integrated into migrations.

## Key Design Decisions

### 1. No CASL/Oso/Cerbos Installation

We borrow architectural ideas but don't install the products, keeping dependencies minimal and avoiding vendor lock-in.

### 2. Zod-Validated Policies

Policies are validated Zod schemas, not arbitrary JavaScript, preventing code injection and ensuring serializability.

### 3. Permissions Not in JWT

Permissions remain database-backed, allowing real-time changes without token refresh.

### 4. RLS Per Role NOT Generated

RLS policies are generic infrastructure. Roles are data. This keeps migrations stable as roles change.

### 5. Explicit DENY Precedence

Explicit DENY always wins over ALLOW, preventing privilege escalation through role combinations.

## Migration Strategy

1. **Initial Setup**: Run `pnpm db:reset` - creates schema + RLS + seed in one step
2. **Schema Changes**: Create migrations normally with `pnpm db:migrate`
3. **RLS Updates**: Add RLS SQL to migrations when security infrastructure changes
4. **Role/Permission Changes**: Update via API/seed - no migration needed

## Testing

### Unit Tests

Test individual components:

```typescript
describe("AuthorizationKernelService", () => {
  it("should DENY by default", async () => {
    const result = await service.can(request);
    expect(result.decision).toBe("DENY");
  });

  it("should ALLOW superadmin", async () => {
    request.subject.isSuperAdmin = true;
    const result = await service.can(request);
    expect(result.decision).toBe("ALLOW");
  });
});
```

### Integration Tests

Test combined authorization + RLS:

```typescript
it("should enforce organization isolation", async () => {
  // User A tries to access User B's organization
  const result = await service.can({
    subject: { userId: "userA", organizationId: "orgA" },
    action: "READ",
    resource: "ORDER",
    resourceId: "order-in-orgB",
  });
  expect(result.decision).toBe("DENY");
});
```

## Performance Considerations

1. **Caching**: Role/permission lookups can be cached with proper invalidation
2. **Filter() Usage**: Prefer `filter()` over loading all rows and filtering in JS
3. **RLS Overhead**: RLS adds minimal overhead (<1ms) for most queries
4. **Audit Volume**: Audit logs grow over time - implement retention policies

## Security Best Practices

1. **Never Trust Client Input**: Always verify organization/location membership
2. **Use Transaction Context**: RLS context must be in same transaction as queries
3. **Fail Closed**: Missing context → DENY, not ALLOW
4. **Audit DENY**: Always log denied requests for security monitoring
5. **Regular Reviews**: Review ACL entries and policies periodically

## Future Enhancements

- **Field-Level Permissions**: Control access to specific fields
- **Temporal Policies**: Time-based access rules
- **Policy Versioning**: Track policy changes over time
- **Policy Testing UI**: Admin interface for testing policies
- **Relationship Graph**: More sophisticated ReBAC via graph traversal
- **Policy Simulation**: Test policies before activation

## References

- Authorization Kernel Architecture Spec: `uploads/authorization-kernel-architecture_ed77.md`
- RBAC+ACL+RLS Architecture Spec: `uploads/rbac-acl-rls-architecture_1a91.md`
- Prisma Schema: `apps/api/prisma/schema.prisma`
- Init Migration: `apps/api/prisma/migrations/20260914155553_init/migration.sql`

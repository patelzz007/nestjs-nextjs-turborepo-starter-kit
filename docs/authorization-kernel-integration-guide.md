# Authorization Kernel Integration Guide

This guide shows how to integrate the Authorization Kernel into controllers and services throughout the API.

## Table of Contents
1. [Quick Start](#quick-start)
2. [Integration Patterns](#integration-patterns)
3. [Controller Examples](#controller-examples)
4. [Service Examples](#service-examples)
5. [Common Scenarios](#common-scenarios)
6. [Migration Checklist](#migration-checklist)

## Quick Start

### Import the Helper

```typescript
import { KernelIntegrationHelper } from '../authorization/kernel/kernel-integration.helper';

@Injectable()
export class YourService {
  constructor(private readonly kernelHelper: KernelIntegrationHelper) {}
}
```

### Basic Usage

```typescript
// Check if user can create a resource
await this.kernelHelper.requireAction(userId, "CREATE", "ORDER", { organizationId });

// Check if user can access specific resource
await this.kernelHelper.requireResourceAccess(userId, "UPDATE", "ORDER", orderId, { organizationId });

// Filter query results
const filter = await this.kernelHelper.getQueryFilter(userId, "READ", "ORDER", { organizationId });
const orders = await prisma.order.findMany({ where: { ...filter, status: "ACTIVE" } });
```

## Integration Patterns

### Pattern 1: Resource Creation

**Before:**
```typescript
@Post()
public async createOrder(@GetUser() user: AccessTokenPayload, @Body() body: CreateOrderDto) {
  // No authorization check or basic permission check
  return this.orderService.create(user.sub, body);
}
```

**After (with Kernel):**
```typescript
@Post()
public async createOrder(@GetUser() user: AccessTokenPayload, @Body() body: CreateOrderDto) {
  // Kernel handles RBAC + ACL + Policies + Ownership
  await this.kernelHelper.requireAction(
    user.sub,
    "CREATE",
    "ORDER",
    { organizationId: body.organizationId }
  );
  
  return this.orderService.create(user.sub, body);
}
```

### Pattern 2: Resource Read (Single)

**Before:**
```typescript
@Get(':id')
public async getOrder(@GetUser() user: AccessTokenPayload, @Param('id') id: string) {
  const order = await this.orderService.findById(id);
  // Maybe check if order.userId === user.sub
  return order;
}
```

**After (with Kernel):**
```typescript
@Get(':id')
public async getOrder(@GetUser() user: AccessTokenPayload, @Param('id') id: string) {
  const order = await this.orderService.findById(id);
  
  await this.kernelHelper.requireResourceAccess(
    user.sub,
    "READ",
    "ORDER",
    id,
    {
      organizationId: order.organizationId,
      resourceAttributes: { ownerId: order.userId, status: order.status }
    }
  );
  
  return order;
}
```

### Pattern 3: Resource List/Query

**Before:**
```typescript
@Get()
public async listOrders(@GetUser() user: AccessTokenPayload, @Query() query: ListQuery) {
  // Returns all orders or basic filtering
  return this.orderService.findMany({
    where: { organizationId: query.organizationId },
  });
}
```

**After (with Kernel):**
```typescript
@Get()
public async listOrders(@GetUser() user: AccessTokenPayload, @Query() query: ListQuery) {
  // Kernel generates WHERE conditions based on RBAC + ACL + Ownership
  const authFilter = await this.kernelHelper.getQueryFilter(
    user.sub,
    "READ",
    "ORDER",
    { organizationId: query.organizationId }
  );
  
  return this.orderService.findMany({
    where: { ...authFilter, ...query },
  });
}
```

### Pattern 4: Resource Update

**Before:**
```typescript
@Patch(':id')
public async updateOrder(
  @GetUser() user: AccessTokenPayload,
  @Param('id') id: string,
  @Body() body: UpdateOrderDto
) {
  return this.orderService.update(id, body);
}
```

**After (with Kernel):**
```typescript
@Patch(':id')
public async updateOrder(
  @GetUser() user: AccessTokenPayload,
  @Param('id') id: string,
  @Body() body: UpdateOrderDto
) {
  const order = await this.orderService.findById(id);
  
  await this.kernelHelper.requireResourceAccess(
    user.sub,
    "UPDATE",
    "ORDER",
    id,
    {
      organizationId: order.organizationId,
      resourceAttributes: { ownerId: order.userId }
    }
  );
  
  return this.orderService.update(id, body);
}
```

### Pattern 5: Resource Deletion

**Before:**
```typescript
@Delete(':id')
public async deleteOrder(@GetUser() user: AccessTokenPayload, @Param('id') id: string) {
  return this.orderService.delete(id);
}
```

**After (with Kernel):**
```typescript
@Delete(':id')
public async deleteOrder(@GetUser() user: AccessTokenPayload, @Param('id') id: string) {
  const order = await this.orderService.findById(id);
  
  await this.kernelHelper.requireResourceAccess(
    user.sub,
    "DELETE",
    "ORDER",
    id,
    {
      organizationId: order.organizationId,
      resourceAttributes: { ownerId: order.userId }
    }
  );
  
  return this.orderService.delete(id);
}
```

### Pattern 6: Batch Operations

**Before:**
```typescript
@Post('batch-delete')
public async batchDeleteOrders(
  @GetUser() user: AccessTokenPayload,
  @Body() body: { orderIds: string[] }
) {
  // Delete all without checking each
  return this.orderService.deleteMany(body.orderIds);
}
```

**After (with Kernel):**
```typescript
@Post('batch-delete')
public async batchDeleteOrders(
  @GetUser() user: AccessTokenPayload,
  @Body() body: { orderIds: string[] }
) {
  // Check each order individually
  const permissions = await this.kernelHelper.batchCheckResources(
    user.sub,
    "DELETE",
    "ORDER",
    body.orderIds
  );
  
  // Only delete allowed orders
  const allowedIds = body.orderIds.filter(id => permissions[id]);
  
  if (allowedIds.length === 0) {
    throw new ForbiddenException("No orders can be deleted");
  }
  
  return this.orderService.deleteMany(allowedIds);
}
```

## Controller Examples

### Rewards Controller Integration

```typescript
import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { KernelIntegrationHelper } from '../../authorization/kernel/kernel-integration.helper';

@Controller('rewards')
export class RewardsController {
  constructor(
    private readonly rewardsService: RewardsService,
    private readonly kernelHelper: KernelIntegrationHelper,
  ) {}

  @Post()
  async createReward(@GetUser() user: AccessTokenPayload, @Body() body: CreateRewardDto) {
    await this.kernelHelper.requireAction(
      user.sub,
      "CREATE",
      "REWARD",
      { organizationId: body.organizationId }
    );

    return this.rewardsService.create(body);
  }

  @Get()
  async listRewards(@GetUser() user: AccessTokenPayload, @Query() query: QueryDto) {
    const filter = await this.kernelHelper.getQueryFilter(
      user.sub,
      "READ",
      "REWARD",
      { organizationId: query.organizationId }
    );

    return this.rewardsService.findMany({ where: filter });
  }

  @Patch(':id')
  async updateReward(
    @GetUser() user: AccessTokenPayload,
    @Param('id') id: string,
    @Body() body: UpdateRewardDto
  ) {
    const reward = await this.rewardsService.findById(id);

    await this.kernelHelper.requireResourceAccess(
      user.sub,
      "UPDATE",
      "REWARD",
      id,
      {
        organizationId: reward.organizationId,
        resourceAttributes: { ownerId: reward.createdBy }
      }
    );

    return this.rewardsService.update(id, body);
  }
}
```

### Organization Controller Integration

```typescript
import { Controller, Get, Post, Patch, Param, Body } from '@nestjs/common';
import { KernelIntegrationHelper } from '../../authorization/kernel/kernel-integration.helper';

@Controller('organizations')
export class OrganizationController {
  constructor(
    private readonly orgService: OrganizationService,
    private readonly kernelHelper: KernelIntegrationHelper,
  ) {}

  @Post()
  async createOrganization(@GetUser() user: AccessTokenPayload, @Body() body: CreateOrgDto) {
    await this.kernelHelper.requireAction(user.sub, "CREATE", "ORGANIZATION");
    return this.orgService.create(user.sub, body);
  }

  @Get()
  async listOrganizations(@GetUser() user: AccessTokenPayload) {
    const filter = await this.kernelHelper.getQueryFilter(user.sub, "READ", "ORGANIZATION");
    return this.orgService.findMany({ where: filter });
  }

  @Patch(':id')
  async updateOrganization(
    @GetUser() user: AccessTokenPayload,
    @Param('id') id: string,
    @Body() body: UpdateOrgDto
  ) {
    await this.kernelHelper.requireResourceAccess(user.sub, "UPDATE", "ORGANIZATION", id);
    return this.orgService.update(id, body);
  }
}
```

## Service Examples

### Integrating Kernel into Service Layer

```typescript
import { Injectable } from '@nestjs/common';
import { KernelIntegrationHelper } from '../authorization/kernel/kernel-integration.helper';

@Injectable()
export class OrderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly kernelHelper: KernelIntegrationHelper,
  ) {}

  async findUserOrders(userId: string, organizationId?: string) {
    // Apply kernel filtering at the database level
    const authFilter = await this.kernelHelper.getQueryFilter(
      userId,
      "READ",
      "ORDER",
      { organizationId }
    );

    return this.prisma.order.findMany({
      where: {
        ...authFilter,
        // Add additional business logic filters
        status: { not: "DELETED" },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createOrder(userId: string, data: CreateOrderData) {
    // Check authorization before creation
    await this.kernelHelper.requireAction(
      userId,
      "CREATE",
      "ORDER",
      { organizationId: data.organizationId }
    );

    return this.prisma.order.create({
      data: {
        ...data,
        userId,
        status: "PENDING",
      },
    });
  }

  async updateOrder(userId: string, orderId: string, data: UpdateOrderData) {
    const order = await this.prisma.order.findUniqueOrThrow({
      where: { id: orderId },
    });

    // Check resource-level authorization
    await this.kernelHelper.requireResourceAccess(
      userId,
      "UPDATE",
      "ORDER",
      orderId,
      {
        organizationId: order.organizationId,
        resourceAttributes: { ownerId: order.userId, status: order.status }
      }
    );

    return this.prisma.order.update({
      where: { id: orderId },
      data,
    });
  }
}
```

## Common Scenarios

### Scenario 1: Multi-Tenant Organization Access

```typescript
// User must be member of organization to access
const filter = await this.kernelHelper.getQueryFilter(
  userId,
  "READ",
  "ORDER",
  { organizationId }
);

// Kernel automatically adds organization isolation
// Result: { OR: [{ organizationId: "org-123" }, { userId: "user-456" }] }
```

### Scenario 2: Location-Based Access

```typescript
// User at specific location can only see location's data
const filter = await this.kernelHelper.getQueryFilter(
  userId,
  "READ",
  "INVENTORY",
  {
    organizationId,
    locationId: "loc-123"
  }
);

// Kernel adds location scope
// Result: { OR: [{ locationId: "loc-123" }, { userId: "user-456" }] }
```

### Scenario 3: Ownership-Only Access

```typescript
// Only resource owner can delete
await this.kernelHelper.requireResourceAccess(
  userId,
  "DELETE",
  "ORDER",
  orderId,
  {
    organizationId,
    resourceAttributes: { ownerId: order.userId }
  }
);

// Kernel checks: ownership || ACL ALLOW || Policy ALLOW || Role permission
```

### Scenario 4: Conditional Access with Policies

```typescript
// Business hours policy applies
await this.kernelHelper.requireResourceAccess(
  userId,
  "UPDATE",
  "PAYMENT",
  paymentId,
  {
    organizationId,
    resourceAttributes: {
      amount: payment.amount,
      status: payment.status
    }
  }
);

// Kernel evaluates:
// 1. ACL DENY? → Block
// 2. Business hours policy? → Check time
// 3. Amount threshold policy? → Check amount
// 4. Role permission? → Check RBAC
```

## Migration Checklist

### For Each Controller

- [ ] Inject `KernelIntegrationHelper` in constructor
- [ ] Add `requireAction()` to CREATE endpoints
- [ ] Add `requireResourceAccess()` to UPDATE/DELETE endpoints
- [ ] Add `getQueryFilter()` to LIST/QUERY endpoints
- [ ] Add `canAccessResource()` for conditional rendering
- [ ] Add `batchCheckResources()` for batch operations
- [ ] Pass `organizationId` and `locationId` context
- [ ] Include resource attributes for policy evaluation

### For Each Service

- [ ] Inject `KernelIntegrationHelper` if managing resources
- [ ] Apply `getQueryFilter()` to all query methods
- [ ] Add resource checks before mutations
- [ ] Pass full context (org, location, attributes)
- [ ] Handle ForbiddenException from kernel
- [ ] Log authorization decisions for auditing

### Testing

- [ ] Test DENY scenarios (ACL, Policy, default)
- [ ] Test ALLOW scenarios (ACL, Role, Ownership)
- [ ] Test organization isolation
- [ ] Test location isolation
- [ ] Test ownership checks
- [ ] Test policy conditions (time, attributes)
- [ ] Test super-admin bypass
- [ ] Test batch operations

## Best Practices

1. **Always check before mutating** - Use `requireAction()` or `requireResourceAccess()` before any CREATE/UPDATE/DELETE
2. **Filter at the database level** - Use `getQueryFilter()` for all list/query operations
3. **Pass full context** - Always include `organizationId`, `locationId`, and relevant `resourceAttributes`
4. **Use batch methods for bulk operations** - Use `batchCheckResources()` instead of loops
5. **Handle exceptions gracefully** - Kernel throws `ForbiddenException` with details
6. **Audit important operations** - Kernel automatically audits, but add business-level logging too
7. **Test authorization thoroughly** - Write tests for all DENY and ALLOW paths

## Resources

- **Main Docs**: `/docs/authorization-kernel.md`
- **Kernel Services**: `/apps/api/src/modules/authorization/kernel/`
- **Example Controller**: `/apps/api/src/modules/authorization/kernel/examples.controller.ts`
- **Shared Types**: `/packages/shared/src/authorization/`

## Support

For questions or issues:
1. Check `/docs/authorization-kernel.md` for architecture details
2. Review example controller for usage patterns
3. Check `KernelIntegrationHelper` source for all available methods
4. Use `explain()` method for debugging authorization decisions

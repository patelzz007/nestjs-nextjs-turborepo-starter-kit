# Authorization Kernel - Proper Refactor Plan

## 🎯 Goal
Transform the Authorization Kernel from a "bolt-on" layer into the PRIMARY and ONLY authorization system.

---

## 📊 Current Problems

### 1. Dual Authorization System
```typescript
// AuthorizationGuard.ts - Lines 150-160
if (this.useKernel) {
  const decision = await this.kernel.can(...);  // New way
  granted = decision === "ALLOW";
} else {
  granted = await this.checker.hasPermission(...);  // Old way
}
```

### 2. Redundant Controller Checks
```typescript
// Current: Both decorator AND manual check
@RequirePermission("CREATE", "ORDER")  // Old decorator
public async create(@GetUser("sub") userId: string, ...) {
  await this.kernelHelper.requireAction(userId, "CREATE", "ORDER");  // New manual check
}
```

### 3. Service Layer Confusion
- `AuthorizationCheckerService` - Old permission checking
- `AuthorizationKernelService` - New kernel
- `KernelIntegrationHelper` - Wrapper around kernel
- Result: Which one is "the truth"?

---

## ✨ Target Architecture

### Single Authorization Flow
```
Request 
  → AuthorizationGuard (kernel-powered)
    → Kernel Decision (RBAC → ACL → Policy → Ownership)
      → Database (RLS enforcement)
```

### Clean Controller Pattern
```typescript
// Single decorator, kernel-powered
@Authorize({ action: "CREATE", resource: "ORDER" })
public async create(@GetUser("sub") userId: string, data: CreateOrderDto) {
  // No manual checks - guard handles it
  return this.orderService.create(userId, data);
}

// Or even simpler - infer from method name
@Post()
public async create(...) {
  // Auto-detects CREATE operation
}
```

---

## 🔧 Refactor Steps

### Phase 1: Core Services (Week 1)

#### 1.1 Simplify AuthorizationGuard
**File:** `apps/api/src/modules/authorization/guards/authorization.guard.ts`

**Changes:**
- Remove `useKernel` flag and branching
- Remove dependency on `AuthorizationCheckerService`
- Make kernel the ONLY authorization path
- Simplify to ~100 lines (currently 276 lines)

**New signature:**
```typescript
@Injectable()
export class AuthorizationGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly kernel: AuthorizationKernelService,
    private readonly audit: AuthorizationAuditService,
    private readonly prisma: PrismaService,
  ) {}
  
  async canActivate(context: ExecutionContext): Promise<boolean> {
    // 1. Extract metadata
    // 2. Extract user
    // 3. Super-admin bypass
    // 4. Kernel authorization check
    // 5. Return true/throw
  }
}
```

#### 1.2 Deprecate AuthorizationCheckerService
**File:** `apps/api/src/modules/authorization/services/authorization-checker.service.ts`

**Options:**
- **Option A:** Delete entirely (breaking change)
- **Option B:** Make it a thin wrapper around kernel (backward compatible)
- **Recommended:** Option B for gradual migration

**New implementation:**
```typescript
@Injectable()
export class AuthorizationCheckerService {
  constructor(private readonly kernel: AuthorizationKernelService) {}
  
  async hasPermission(userId: string, action: PermissionAction, resource: PermissionResource): Promise<boolean> {
    const decision = await this.kernel.can({ userId, action, resource });
    return decision === "ALLOW";
  }
  
  // All other methods delegate to kernel
}
```

#### 1.3 Remove KernelIntegrationHelper
**File:** `apps/api/src/modules/authorization/kernel/kernel-integration.helper.ts`

**Action:** Delete this file and update all imports to use kernel directly or decorators

**Reasoning:** 
- Adds unnecessary indirection
- Controllers should use decorators, not manual calls
- Services should inject kernel directly if needed

---

### Phase 2: Decorators (Week 1)

#### 2.1 Create Unified @Authorize Decorator
**New file:** `apps/api/src/modules/authorization/decorators/authorize.decorator.ts`

```typescript
import { SetMetadata } from "@nestjs/common";

export const AUTHORIZATION_KEY = "authorization:requirement";

export interface AuthorizationRequirement {
  action: PermissionAction;
  resource: PermissionResource;
  resourceId?: string | ((context: ExecutionContext) => string);
  context?: Record<string, unknown>;
}

export const Authorize = (requirement: AuthorizationRequirement) =>
  SetMetadata(AUTHORIZATION_KEY, requirement);
```

**Usage:**
```typescript
// Simple permission check
@Authorize({ action: "CREATE", resource: "ORDER" })

// With resource ID from path param
@Authorize({ 
  action: "UPDATE", 
  resource: "ORDER",
  resourceId: (ctx) => ctx.switchToHttp().getRequest().params.id
})

// With organization context
@Authorize({ 
  action: "CREATE", 
  resource: "LOCATION",
  context: { organizationId: "org-id" }
})
```

#### 2.2 Deprecate Old Decorators
Mark as deprecated but keep for backward compatibility:
- `@RequirePermission` → Use `@Authorize`
- `@RequireAllPermissions` → Use multiple `@Authorize`
- `@RequireAnyPermission` → Use `@Authorize` with OR logic
- `@RequireAllRoles` → Use role-based `@Authorize`
- `@RequireAnyRole` → Use role-based `@Authorize`

---

### Phase 3: Controllers (Week 2)

#### 3.1 Update All Controllers
Remove manual `kernelHelper` calls and rely solely on decorators:

**Before (122 files):**
```typescript
constructor(
  private readonly service: OrderService,
  private readonly kernelHelper: KernelIntegrationHelper,  // Remove
) {}

@Post()
async create(@GetUser("sub") userId: string, @Body() data: CreateOrderDto) {
  await this.kernelHelper.requireAction(userId, "CREATE", "ORDER");  // Remove
  return this.service.create(userId, data);
}
```

**After:**
```typescript
constructor(
  private readonly service: OrderService,  // Clean!
) {}

@Post()
@Authorize({ action: "CREATE", resource: "ORDER" })  // Single decorator
async create(@GetUser("sub") userId: string, @Body() data: CreateOrderDto) {
  return this.service.create(userId, data);  // Clean!
}
```

#### 3.2 Pattern for Resource-Specific Operations
```typescript
@Patch(":id")
@Authorize({ 
  action: "UPDATE", 
  resource: "ORDER",
  resourceId: (ctx) => ctx.switchToHttp().getRequest().params.id
})
async update(@Param("id") id: string, @Body() data: UpdateOrderDto) {
  return this.service.update(id, data);
}
```

---

### Phase 4: Services (Week 2)

#### 4.1 Service-Level Authorization
For complex business logic, services can inject kernel directly:

```typescript
@Injectable()
export class OrderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly kernel: AuthorizationKernelService,  // Direct injection
  ) {}
  
  async create(userId: string, data: CreateOrderDto) {
    // Authorization already done by guard, but can add extra checks
    await this.kernel.authorize({
      subject: { userId },
      action: "CREATE",
      resource: "ORDER",
      context: { organizationId: data.organizationId }
    });
    
    return this.prisma.order.create({ data });
  }
}
```

---

### Phase 5: Testing (Week 3)

#### 5.1 Kernel Unit Tests
**File:** `apps/api/src/modules/authorization/kernel/__tests__/authorization-kernel.service.spec.ts`

```typescript
describe("AuthorizationKernelService", () => {
  describe("can()", () => {
    it("should DENY by default", async () => {
      const decision = await kernel.can({
        userId: "user-1",
        action: "CREATE",
        resource: "ORDER",
      });
      expect(decision).toBe("DENY");
    });
    
    it("should ALLOW with valid role permission", async () => {
      // Setup: user has role with permission
      const decision = await kernel.can({
        userId: "user-with-permission",
        action: "CREATE",
        resource: "ORDER",
      });
      expect(decision).toBe("ALLOW");
    });
    
    it("should respect ACL DENY precedence", async () => {
      // Setup: user has permission but ACL DENY exists
      const decision = await kernel.can({
        userId: "user-with-acl-deny",
        action: "CREATE",
        resource: "ORDER",
      });
      expect(decision).toBe("DENY");
    });
  });
  
  describe("explain()", () => {
    it("should provide full decision trace", async () => {
      const result = await kernel.explain({
        userId: "user-1",
        action: "CREATE",
        resource: "ORDER",
      });
      
      expect(result).toMatchObject({
        decision: "DENY",
        evaluationSteps: expect.arrayContaining([
          expect.objectContaining({ stage: "ACL" }),
          expect.objectContaining({ stage: "POLICY" }),
          expect.objectContaining({ stage: "ROLE" }),
        ]),
      });
    });
  });
});
```

#### 5.2 Guard Integration Tests
```typescript
describe("AuthorizationGuard (kernel-powered)", () => {
  it("should block unauthorized requests", async () => {
    const result = await guard.canActivate(mockContext);
    expect(result).toBe(false);
  });
  
  it("should allow authorized requests", async () => {
    // Setup: mock user with valid permission
    const result = await guard.canActivate(mockContext);
    expect(result).toBe(true);
  });
  
  it("should bypass for super-admins", async () => {
    // Setup: mock super-admin user
    const result = await guard.canActivate(mockContext);
    expect(result).toBe(true);
  });
});
```

#### 5.3 E2E Authorization Tests
**File:** `apps/api/test/authorization-kernel.e2e-spec.ts`

```typescript
describe("Authorization Kernel E2E", () => {
  describe("POST /orders (CREATE)", () => {
    it("should allow with valid permission", () => {
      return request(app.getHttpServer())
        .post("/api/v1/orders")
        .set("Authorization", `Bearer ${tokenWithPermission}`)
        .send({ ... })
        .expect(201);
    });
    
    it("should deny without permission", () => {
      return request(app.getHttpServer())
        .post("/api/v1/orders")
        .set("Authorization", `Bearer ${tokenWithoutPermission}`)
        .send({ ... })
        .expect(403)
        .expect((res) => {
          expect(res.body.error).toBe("PERMISSION_DENIED");
        });
    });
    
    it("should respect ACL DENY", () => {
      // Setup: user has permission but ACL DENY exists
      return request(app.getHttpServer())
        .post("/api/v1/orders")
        .set("Authorization", `Bearer ${tokenWithAclDeny}`)
        .send({ ... })
        .expect(403);
    });
  });
  
  describe("Organization-scoped resources", () => {
    it("should enforce organization isolation", () => {
      // User can only access their own org's resources
    });
  });
  
  describe("RLS enforcement", () => {
    it("should filter results at database level", () => {
      // Verify RLS policies are active
    });
  });
});
```

---

## 📝 Migration Checklist

### Breaking Changes
- [ ] Remove `KernelIntegrationHelper` from all controllers
- [ ] Remove `useKernel` flag from `AuthorizationGuard`
- [ ] Remove dependency on `AuthorizationCheckerService` in guard
- [ ] Update all 122 controllers to use decorators only

### Backward Compatibility
- [ ] Keep old decorators but mark as deprecated
- [ ] Make `AuthorizationCheckerService` delegate to kernel
- [ ] Provide migration guide for external users

### Testing
- [ ] Unit tests for `AuthorizationKernelService` (all methods)
- [ ] Unit tests for `PolicyEngineService`
- [ ] Unit tests for `AclService`
- [ ] Integration tests for `AuthorizationGuard`
- [ ] E2E tests for all resource types
- [ ] E2E tests for all authorization scenarios (ALLOW/DENY)
- [ ] RLS integration tests
- [ ] Performance tests (authorization latency)

### Documentation
- [ ] Update `authorization-kernel.md` with new architecture
- [ ] Create migration guide from old to new
- [ ] Update integration guide with decorator patterns
- [ ] Add troubleshooting guide
- [ ] Add performance tuning guide

---

## 📊 Success Metrics

### Code Quality
- [ ] Guard reduced from 276 lines to ~100 lines
- [ ] Single authorization path (no if/else)
- [ ] Controllers have no manual authorization calls
- [ ] Test coverage > 80% for kernel components

### Performance
- [ ] Authorization check latency < 10ms p95
- [ ] No N+1 queries in authorization checks
- [ ] Cache hit rate > 90% for permission lookups

### Security
- [ ] All sensitive operations protected
- [ ] Deny-by-default verified in tests
- [ ] RLS policies active for all tables
- [ ] Audit logging for all authorization decisions

---

## 🚀 Timeline

### Week 1: Core Refactor
- Day 1-2: Refactor AuthorizationGuard (kernel-only)
- Day 3-4: Create new @Authorize decorator
- Day 5: Deprecate old services and helpers

### Week 2: Controller Migration
- Day 1-3: Update all 122 controllers
- Day 4-5: Service layer patterns

### Week 3: Testing & Documentation
- Day 1-3: Write comprehensive tests
- Day 4-5: Update documentation and migration guide

---

## 🎯 End State

### Clean Architecture
```
Request → Guard (@Authorize decorator) → Kernel → Database (RLS)
```

### Clean Controller
```typescript
@Controller("/orders")
export class OrdersController {
  constructor(private readonly orders: OrderService) {}
  
  @Post()
  @Authorize({ action: "CREATE", resource: "ORDER" })
  async create(@GetUser("sub") userId: string, @Body() data: CreateOrderDto) {
    return this.orders.create(userId, data);
  }
  
  @Patch(":id")
  @Authorize({ action: "UPDATE", resource: "ORDER", resourceId: "id" })
  async update(@Param("id") id: string, @Body() data: UpdateOrderDto) {
    return this.orders.update(id, data);
  }
}
```

### Single Source of Truth
- ✅ One authorization system (kernel)
- ✅ One decorator pattern (`@Authorize`)
- ✅ One guard implementation
- ✅ Clean, maintainable, testable

---

**Status:** Ready for implementation with comprehensive testing
**Breaking Changes:** Acceptable (starter kit, no production users)
**Outcome:** Production-ready, kernel-first architecture

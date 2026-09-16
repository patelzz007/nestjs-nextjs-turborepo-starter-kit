# Authorization Context Middleware

## Overview
The `AuthorizationContextMiddleware` automatically extracts common authorization context (like `organizationId`, `locationId`, `resourceId`) from requests, eliminating repetitive context extraction in decorators.

## Problem it Solves

### Before (Repetitive Context Extraction):
```typescript
@Authorize({
  action: "CREATE",
  resource: "ORDER",
  context: (ctx) => ({
    organizationId: ctx.switchToHttp().getRequest().body?.organizationId ?? null,
  }),
})
async createOrder(@Body() dto: CreateOrderDto) {
  return this.orderService.create(dto);
}

@Authorize({
  action: "UPDATE",
  resource: "ORDER",
  resourceId: "id",
  context: (ctx) => ({
    organizationId: ctx.switchToHttp().getRequest().body?.organizationId ?? null,
  }),
})
async updateOrder(@Param("id") id: string, @Body() dto: UpdateOrderDto) {
  return this.orderService.update(id, dto);
}
```

### After (Clean Decorators):
```typescript
@Authorize({ action: "CREATE", resource: "ORDER" })
async createOrder(@Body() dto: CreateOrderDto) {
  return this.orderService.create(dto);
}

@Authorize({ action: "UPDATE", resource: "ORDER", resourceId: "id" })
async updateOrder(@Param("id") id: string, @Body() dto: UpdateOrderDto) {
  return this.orderService.update(id, dto);
}
```

## How It Works

### 1. Middleware Extraction Strategy

The middleware checks multiple sources for common context values:

```typescript
// organizationId
body.organizationId → params.organizationId → params.orgId → params.orgSlug → query.organizationId

// locationId  
body.locationId → params.locationId → query.locationId

// resourceId (most common pattern)
params.id → params.resourceId
```

### 2. Request Augmentation

Extracted context is attached to `request.authorizationContext`:

```typescript
interface FastifyRequest {
  authorizationContext?: {
    organizationId: string | null;
    locationId: string | null;
    resourceId: string | null;
  };
}
```

### 3. Guard Integration

The `AuthorizationGuard` automatically merges middleware context with decorator context when calling the kernel.

## Usage Examples

### Example 1: Simple CRUD Operations

```typescript
@Controller("orders")
export class OrderController {
  @Post()
  @Authorize({ action: "CREATE", resource: "ORDER" })
  async create(@Body() dto: CreateOrderDto) {
    // organizationId from body automatically available
    return this.orderService.create(dto);
  }

  @Patch(":id")
  @Authorize({ action: "UPDATE", resource: "ORDER", resourceId: "id" })
  async update(@Param("id") id: string, @Body() dto: UpdateOrderDto) {
    // resourceId from params automatically available
    // organizationId from body automatically available
    return this.orderService.update(id, dto);
  }

  @Delete(":id")
  @Authorize({ action: "DELETE", resource: "ORDER", resourceId: "id" })
  async delete(@Param("id") id: string) {
    // resourceId from params automatically available
    return this.orderService.delete(id);
  }
}
```

### Example 2: Organization-Scoped Routes

```typescript
@Controller("orgs/:orgId/locations")
export class LocationController {
  @Post()
  @Authorize({ action: "CREATE", resource: "LOCATION" })
  async create(@Param("orgId") orgId: string, @Body() dto: CreateLocationDto) {
    // organizationId from params automatically available
    return this.locationService.create(dto);
  }

  @Patch(":id")
  @Authorize({ action: "UPDATE", resource: "LOCATION", resourceId: "id" })
  async update(
    @Param("orgId") orgId: string,
    @Param("id") id: string,
    @Body() dto: UpdateLocationDto
  ) {
    // organizationId from params automatically available
    // locationId from body automatically available
    // resourceId from params automatically available
    return this.locationService.update(id, dto);
  }
}
```

### Example 3: Custom Context (When Needed)

You can still provide custom context when middleware extraction isn't sufficient:

```typescript
@Authorize({
  action: "CREATE",
  resource: "ORDER",
  context: (ctx) => ({
    // Middleware provides: organizationId, locationId, resourceId
    // Add custom context:
    orderTotal: ctx.switchToHttp().getRequest().body?.total ?? 0,
    customerTier: ctx.switchToHttp().getRequest().user?.tier ?? "standard",
  }),
})
async createOrder(@Body() dto: CreateOrderDto) {
  return this.orderService.create(dto);
}
```

**Note:** Custom context is **merged** with middleware context (custom takes precedence).

## Benefits

### 1. **DRY (Don't Repeat Yourself)**
- No repetitive context extraction in every decorator
- Common patterns extracted once in middleware

### 2. **Cleaner Code**
- Decorators are more readable
- Less boilerplate in controllers
- Easier to understand authorization requirements

### 3. **Consistent Extraction**
- Single source of truth for context extraction logic
- Predictable behavior across all routes
- Easy to update extraction strategy globally

### 4. **Type Safety**
- TypeScript types for `request.authorizationContext`
- Autocomplete support in IDE
- Compile-time safety

### 5. **Flexibility**
- Middleware provides defaults
- Decorators can override with custom context
- Works seamlessly with both approaches

## Architecture

```
Request
  ↓
AuthorizationContextMiddleware
  ├─ Extracts: organizationId, locationId, resourceId
  └─ Attaches to: request.authorizationContext
  ↓
@Authorize Decorator (optional custom context)
  ↓
AuthorizationGuard
  ├─ Reads: request.authorizationContext (middleware)
  ├─ Reads: decorator context (if provided)
  ├─ Merges: middleware + decorator context
  └─ Calls: AuthorizationKernelService.can()
  ↓
Authorization Decision
```

## Migration Guide

### For New Routes
Just use clean decorators:
```typescript
@Authorize({ action: "CREATE", resource: "ORDER" })
```

### For Existing Routes
1. Remove inline context extraction:
   ```typescript
   // Before
   context: (ctx) => ({
     organizationId: ctx.switchToHttp().getRequest().body?.organizationId,
   })
   
   // After
   // (just delete it)
   ```

2. If custom context is needed, keep only the custom parts:
   ```typescript
   // Before
   context: (ctx) => ({
     organizationId: ctx.switchToHttp().getRequest().body?.organizationId,
     customField: ctx.switchToHttp().getRequest().body?.customField,
   })
   
   // After
   context: (ctx) => ({
     customField: ctx.switchToHttp().getRequest().body?.customField,
   })
   ```

## Edge Cases

### Multiple Parameter Names
The middleware checks common parameter names:
- `organizationId`, `orgId`, `orgSlug` → `organizationId`
- `locationId` → `locationId`
- `id`, `resourceId` → `resourceId`

### Null Safety
All extracted values are type-checked:
```typescript
typeof organizationId === "string" ? organizationId : null
```

### Override Behavior
Decorator context takes precedence over middleware context:
```typescript
// Middleware: { organizationId: "org-1" }
// Decorator: { organizationId: "org-2" }
// Result: { organizationId: "org-2" } ✅
```

## Testing

When writing tests, mock the context:
```typescript
const mockRequest = {
  authorizationContext: {
    organizationId: "test-org-id",
    locationId: "test-location-id",
    resourceId: "test-resource-id",
  },
};
```

## Performance

- **Negligible overhead**: Simple property extraction
- **No database calls**: Pure request parsing
- **Runs once per request**: Before authorization guard

## See Also
- [Authorization Guard Documentation](./authorization-kernel.md)
- [@Authorize Decorator Documentation](./authorize-decorator.md)
- [Authorization Kernel Architecture](./authorization-kernel-architecture.md)

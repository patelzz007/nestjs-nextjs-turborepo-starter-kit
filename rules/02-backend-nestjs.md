# 02 — NestJS Backend Standards

## The mental model

Every request flows through the same set of layers, in the same order, every time: `HTTP → Auth → Validation → Authorization → Controller → Application service → Domain/policy → Repository → Prisma/PostgreSQL → Mapper → Zod/API response`. Once you understand this flow, "where does this code go?" almost always has one obviously correct answer. The single most common mistake juniors make in a NestJS codebase is putting logic in the wrong layer — usually putting business logic in the controller because it's the first file they opened, or putting a database query directly in the controller because it "worked." This document exists to make the correct layer obvious every time.

## Module design

```text
feature/
  application/
    commands/
    queries/
    services/
  domain/
    entities/
    value-objects/
    policies/
  infrastructure/
    prisma/
    messaging/
  presentation/
    http/
  schemas/
  feature.module.ts
```

Don't force every feature to populate every directory — see `01-repository-architecture.md` for the full package/module boundary discussion, including how to avoid circular module dependencies.

## Controllers — thin, and only thin

Controllers **should**: authenticate (via a guard), validate (via a zod pipe), authorize (via a guard/decorator), map transport input into application input, call exactly one application service method, and map the application output into the API response contract.

Controllers **should not**: contain business workflows, contain Prisma queries, publish Kafka messages directly, manipulate Redis directly, or perform complex data transformation.

```ts
// ❌ DON'T — business logic, a direct Prisma call, and manual response shaping
// all crammed into the controller
@Controller('orders')
export class OrdersController {
  constructor(private prisma: PrismaService) {}

  @Post()
  async create(@Body() body: any) {
    // no validation at all — `body` is trusted blindly
    const total = body.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    if (total > 10000) {
      // business rule buried in the controller
      throw new BadRequestException('Order too large');
    }
    const order = await this.prisma.order.create({
      data: { customerId: body.customerId, total, items: { create: body.items } },
    });
    // manually shaping the response, duplicated in every endpoint that returns an order
    return { id: order.id, total: order.total, status: order.status };
  }
}

// ✅ DO — controller only orchestrates; everything else has a home
@Controller('orders')
export class OrdersController {
  public constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @UseGuards(AuthGuard, PermissionGuard(Permission.ORDER_CREATE))
  public async create(
    @Body(new ZodValidationPipe(CreateOrderSchema)) dto: CreateOrderDto,
    @CurrentUser() user: AuthUser,
  ): Promise<OrderResponseDto> {
    return this.ordersService.create(dto, user);
  }
}
```

Every endpoint's guards/permissions must be explicitly mapped, not assumed from context or copied from a neighboring endpoint without checking it's actually correct for this one — see `10-security-auth-authorization.md`'s per-endpoint mapping requirement.

## Services — where business orchestration lives

Application services orchestrate use cases; the actual domain *rules* live in `domain/`/policy code, not inline in the service method, once a rule is non-trivial enough to be worth naming and testing on its own.

```ts
// ❌ DON'T — the "can this order be placed" rule is buried inline,
// untestable on its own, and will be copy-pasted the next time a
// second place needs to check the same rule
export class OrdersService {
  public async create(dto: CreateOrderDto, user: AuthUser): Promise<Order> {
    const customer = await this.customers.findById(dto.customerId);
    if (customer.creditLimit < dto.total) {
      throw new CreditLimitExceededError(customer.id);
    }
    if (customer.status === 'suspended') {
      throw new CustomerSuspendedError(customer.id);
    }
    // ...more inline rule-checking...
    return this.repository.save(this.toEntity(dto));
  }
}

// ✅ DO — the rule is named, testable independently, and reusable
export class OrderEligibilityPolicy {
  public canPlaceOrder(customer: Customer, orderTotal: number): OrderEligibilityResult {
    if (customer.status === 'suspended') {
      return { eligible: false, reason: 'customer_suspended' };
    }
    if (customer.creditLimit < orderTotal) {
      return { eligible: false, reason: 'credit_limit_exceeded' };
    }
    return { eligible: true };
  }
}

export class OrdersService {
  public constructor(
    private readonly customers: CustomersRepository,
    private readonly eligibility: OrderEligibilityPolicy,
    private readonly repository: OrdersRepository,
  ) {}

  public async create(dto: CreateOrderDto, user: AuthUser): Promise<Order> {
    const customer = await this.customers.findById(dto.customerId);
    const result = this.eligibility.canPlaceOrder(customer, dto.total);
    if (!result.eligible) throw new OrderNotEligibleError(result.reason);
    return this.repository.save(this.toEntity(dto));
  }
}
```

Every public and private method has an explicit access modifier and return type (`00-non-negotiables.md`). Don't skip this in services because "it's just internal" — services are exactly where the most important, most-reused logic in the backend lives, and that's precisely where an unclear signature costs the most.

## OOP shape of services

Which of inheritance, composition, interfaces, and encapsulation to reach for when designing a service or module is covered in full in `21-oop-and-solid-principles.md`. Short version, with an example of getting it wrong:

```ts
// ❌ DON'T — inheritance used where composition (dependency injection) was the right tool
export abstract class BaseOrderService {
  protected abstract validate(dto: unknown): void;
  public async create(dto: unknown): Promise<Order> {
    this.validate(dto);
    // ...
  }
}
export class StandardOrdersService extends BaseOrderService {
  protected validate(dto: unknown): void { /* ... */ }
}
export class WholesaleOrdersService extends BaseOrderService {
  protected validate(dto: unknown): void { /* different rules, forced into the same shape */ }
}
// Every time WholesaleOrdersService needs to do something BaseOrderService's
// `create` method didn't anticipate, either BaseOrderService grows another
// protected hook, or WholesaleOrdersService starts overriding create() entirely
// — at which point the inheritance was never actually buying anything.

// ✅ DO — composition: each concrete service depends on the pieces it needs,
// with no shared base class forcing a one-size-fits-all shape
export class WholesaleOrdersService {
  public constructor(
    private readonly wholesaleEligibility: WholesaleEligibilityPolicy,
    private readonly repository: OrdersRepository,
  ) {}
  public async create(dto: CreateWholesaleOrderDto): Promise<Order> { ... }
}
```

## Prisma — infrastructure, not the domain model

Prisma is infrastructure. Do not return raw Prisma records from public APIs — map persistence models to domain/application DTOs, validated through the same zod schema used elsewhere for that entity.

```ts
// ❌ DON'T — the raw Prisma row, with every internal column (including ones
// that should never leave the server, like an internal risk score), goes
// straight out over the API
@Get(':id')
async findOne(@Param('id') id: string) {
  return this.prisma.order.findUnique({ where: { id } }); // leaks the whole row shape
}

// ✅ DO — repository maps to a domain type; controller returns a validated,
// intentionally-shaped response DTO
export class OrdersRepository {
  public constructor(private readonly prisma: PrismaService) {}

  public async findById(id: OrderId): Promise<Order | null> {
    const row = await this.prisma.order.findUnique({ where: { id }, select: orderSelect });
    return row ? OrderSchema.parse(row) : null;
  }
}
```

Avoid massive `include` trees — fetch only the relations the specific use case actually needs, not "everything, in case something downstream wants it." Prefer explicit `select`/query objects over "fetch everything and filter/pick fields in application code," which wastes a database round trip's worth of bandwidth on data nobody asked for.

## Base repository — how far to take it, and where it stops

A thin, genuinely generic `Repository<TEntity, TId>` interface (and, where the CRUD shape is truly identical across entities, a generic base implementation) is a legitimate, encouraged abstraction — it satisfies every criterion in `00-non-negotiables.md`'s "when to abstract" list: real reuse across many entities, a stable contract, and it removes duplicated boilerplate that would otherwise need to change in twenty places at once if the CRUD pattern itself ever changed.

```ts
export interface Repository<TEntity, TId> {
  findById(id: TId): Promise<TEntity | null>;
  save(entity: TEntity): Promise<TEntity>;
  delete(id: TId): Promise<void>;
}

export abstract class PrismaBaseRepository<TEntity, TId, TRow> implements Repository<TEntity, TId> {
  protected constructor(protected readonly prisma: PrismaService) {}

  public abstract findById(id: TId): Promise<TEntity | null>;
  public abstract save(entity: TEntity): Promise<TEntity>;
  public abstract delete(id: TId): Promise<void>;
  protected abstract toDomain(row: TRow): TEntity;
}

export class OrdersRepository extends PrismaBaseRepository<Order, OrderId, PrismaOrderRow> {
  public async findById(id: OrderId): Promise<Order | null> {
    const row = await this.prisma.order.findUnique({ where: { id } });
    return row ? this.toDomain(row) : null;
  }
  public async save(entity: Order): Promise<Order> { ... }
  public async delete(id: OrderId): Promise<void> { ... }
  protected toDomain(row: PrismaOrderRow): Order { return OrderSchema.parse(row); }
}
```

### Where this stops being appropriate

```text
❌ DON'T — the base repository grows a feature-specific method because ONE
   caller needed it:

   export abstract class PrismaBaseRepository<TEntity, TId, TRow> {
     ...
     // "just for orders" — but now every repository extending this base
     // carries a method that only makes sense for orders
     public async findByCustomerIdWithDiscountApplied(customerId: string) { ... }
   }

✅ DO — the specific need lives on the CONCRETE repository, and the base
   stays narrow forever:

   export class OrdersRepository extends PrismaBaseRepository<Order, OrderId, PrismaOrderRow> {
     public async findByCustomerId(customerId: CustomerId): Promise<Order[]> { ... }
   }
```

The moment a specific repository needs a method the base doesn't have, that method is added on the **concrete** repository — never pushed into the base "as an optional hook, just in case other repositories want it too." A base repository that slowly accumulates feature-specific methods over time has become exactly the `UniversalManager` anti-pattern `00-non-negotiables.md` warns against, just arrived at gradually instead of all at once. The fix, every time, is: keep the base narrow, put everything else on the concrete class. Full discussion: `21-oop-and-solid-principles.md`.

## Transactions

A transaction represents one atomic business operation.

```ts
// ❌ DON'T — an external HTTP call sitting inside a database transaction.
// If the email provider is slow, this holds a database connection and lock
// open the entire time, and if it fails partway through, you have to
// carefully reason about what state the transaction is now in.
await this.prisma.$transaction(async (tx) => {
  const order = await tx.order.create({ data: dto });
  await this.emailProvider.send(order.customerEmail, confirmationTemplate(order)); // ❌ network call inside a DB transaction
  await tx.inventory.decrement({ where: { sku: dto.sku }, data: { quantity: dto.quantity } });
  return order;
});

// ✅ DO — the transaction covers only the database work; anything external
// happens after commit, or is deferred to a queue/outbox
const order = await this.prisma.$transaction(async (tx) => {
  const created = await tx.order.create({ data: dto });
  await tx.inventory.decrement({ where: { sku: dto.sku }, data: { quantity: dto.quantity } });
  await tx.outbox.create({ data: { eventType: 'order.created', payload: created } });
  return created;
});
// outbox worker picks this up and sends the confirmation email asynchronously
```

Do not keep a database transaction open while calling external HTTP APIs, Kafka, RabbitMQ, email providers, S3/object storage, or other slow I/O. For reliable event publication alongside a DB write, use the outbox pattern (`09-messaging-and-jobs.md`).

## Prisma migrations and seed data

Migrations are versioned production artifacts — never edit an already-applied migration casually, never hand-edit production schema outside the migration process, review destructive migrations carefully, and test rollback/forward recovery for risky ones (`13-ci-cd-and-quality-gates.md`).

**Every schema change that adds or changes a column/table must update `packages/database/prisma/seed.ts` in the same PR.** This is non-negotiable, not optional housekeeping — full requirements and worked examples in `08-database-prisma.md`'s "Seed data" section. The short version: a migration PR that leaves `seed.ts` silently out of sync with the schema is treated the same as a migration PR with no migration file at all — see `16-code-review-checklist.md`.

## Request lifecycle

```text
HTTP → Auth → Validation → Authorization → Controller → Application service → Domain/policy → Repository → Prisma/PostgreSQL → Mapper → Zod/API response
```

Memorize this order. If you're ever unsure which layer a piece of logic belongs in, ask "which of these eight steps is this actually doing?" and that answers the question almost every time.

## Security

Server-side authorization is authoritative — frontend visibility is not authorization. Every request validates authentication, tenant/org context, resource ownership, permission, input shape, pagination bounds, and filter/sort allowlists. Never trust client-provided role/permission claims without independently verifying them server-side.

```ts
// ❌ DON'T — trusting a role claimed by the client without checking it
// against the server's own record of that user's actual role
@Post('admin-action')
async adminAction(@Body() body: { userId: string; claimedRole: string }) {
  if (body.claimedRole === 'admin') { ... } // the client could send anything here
}

// ✅ DO — role/permission comes from the authenticated session/DB lookup,
// never from anything the client sent in the request body
@Post('admin-action')
@UseGuards(AuthGuard, PermissionGuard(Permission.ADMIN_ACTION))
async adminAction(@CurrentUser() user: AuthUser) { ... } // user.role came from the server's own session
```

Full detail: `10-security-auth-authorization.md`.

## API errors

Use stable application error codes; the UI should not need to parse English error strings to know what happened.

```text
code: USER_NOT_FOUND
message: human-readable message
details: structured safe metadata
requestId: correlation identifier
```

```ts
// ❌ DON'T — the frontend has to string-match on English prose to know what went wrong
throw new BadRequestException('The user you are looking for could not be found');

// ✅ DO — a stable, matchable code plus a human-readable message
throw new AppError({
  code: 'USER_NOT_FOUND',
  message: 'The user you are looking for could not be found',
  details: { userId },
});
```

Never expose stack traces or provider secrets (a raw database error message, an internal file path, an SDK exception's full text) to clients.

## Performance — every endpoint should be fast by default, not by heroics

Full detail and checklist: `19-performance-and-scalability.md`. The short version that applies to every endpoint you write:
- No N+1 queries — use `select`/`include` deliberately, or a batching/dataloader pattern for list endpoints that render per-row relations.
- Bounded pagination on every list endpoint — no endpoint should be able to return an unbounded result set, ever, regardless of what the client requests.
- Indexes exist for the access patterns the endpoint actually uses (`08-database-prisma.md`).
- Expensive/cacheable reads use Redis with an explicit TTL and invalidation strategy, not because "it might be slow" but because you've actually identified it as a hot path.

## DTOs vs domain entities — do not conflate them

A request DTO, a response DTO, and a domain entity are three different concepts that happen to often share many field names — that similarity is what tempts people into collapsing them into one type, which is a mistake that compounds over time.

```ts
// ❌ DON'T — one type used for the incoming request, the internal domain
// model, AND the outgoing response. The moment the domain model needs an
// internal-only field (e.g. a computed risk score) or the response needs
// to omit something the domain model has (e.g. an internal cost basis),
// this type has to grow conditional/optional fields that don't belong
// to any one of its three actual jobs
interface Order {
  id: string;
  total: number;
  internalRiskScore: number; // should NEVER be in the response DTO
  costBasis: number;          // should NEVER be in the response DTO either
}

// ✅ DO — three distinct, purpose-built types, each with exactly the
// fields ITS job needs, derived from zod schemas per 05-contracts-zod-api.md
const CreateOrderRequestSchema = z.object({ customerId: z.uuid(), items: z.array(OrderItemSchema) });
const OrderResponseSchema = z.object({ id: z.uuid(), total: z.number(), status: OrderStatusSchema });
// the internal domain Order entity (used inside services/repositories)
// can have MORE fields than the response DTO exposes — the mapper in
// the repository/service is what narrows it down before it reaches the controller
interface OrderEntity {
  id: OrderId;
  total: number;
  status: OrderStatus;
  internalRiskScore: number; // fine here — never leaves this layer
  costBasis: number;
}
```

## Custom decorators — when they're worth it

A custom parameter decorator (`@CurrentUser()`, `@TenantId()`) is worth creating when the same extraction-and-validation logic would otherwise be repeated, verbatim, across many controller methods.

```ts
// ❌ DON'T — the same "get the authenticated user off the request" logic
// copy-pasted into every controller method
@Get(':id')
async findOne(@Req() req: Request) {
  const user = req.user as AuthUser; // and here's a cast, too — doubly wrong
  ...
}

// ✅ DO — a small, well-typed custom decorator, defined once
export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): AuthUser => {
    const request = ctx.switchToHttp().getRequest<Request>();
    return AuthUserSchema.parse(request.user); // validated, not cast
  },
);

@Get(':id')
async findOne(@CurrentUser() user: AuthUser) { ... }
```

Don't go the other direction either — a decorator invented for exactly one call site, wrapping trivial logic, is unnecessary indirection for no real benefit (`00-non-negotiables.md`'s "no speculative abstractions").

## Guards — composing multiple checks correctly

```ts
// ❌ DON'T — one guard trying to do authentication AND every possible
// authorization check inside a single sprawling conditional, which
// becomes unreadable and impossible to reuse selectively per endpoint
@Injectable()
export class MegaGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    if (!req.user) return false;
    if (req.route.path.includes('/admin') && req.user.role !== 'admin') return false;
    if (req.route.path.includes('/rewards') && !req.user.permissions.includes('REWARD.PUBLISH')) return false;
    // ...grows forever, one branch per endpoint that was ever added
    return true;
  }
}

// ✅ DO — small, composable, single-purpose guards, stacked per endpoint
@UseGuards(AuthGuard, PermissionGuard(Permission.REWARD_PUBLISH), OwnershipGuard('reward', 'organization'))
@Post('rewards/:id/publish')
async publish() { ... }
```

## Interceptors and exception filters — global vs scoped

Global interceptors/filters (applied via `app.useGlobalInterceptors()`/`app.useGlobalFilters()`) are for cross-cutting concerns that genuinely apply to every request without exception: the audit log interceptor (`10-security-auth-authorization.md`), a global exception-normalization filter, response timing.

```ts
// ❌ DON'T — a feature-specific concern implemented as a GLOBAL
// interceptor, which now runs (and has to be reasoned about) on every
// single request in the entire application, most of which have nothing
// to do with it
app.useGlobalInterceptors(new RewardPublishingNotificationInterceptor());

// ✅ DO — scope it to exactly where it's needed
@UseInterceptors(RewardPublishingNotificationInterceptor)
@Post('rewards/:id/publish')
async publish() { ... }
```

## Configuration — validated once, at boot, never read ad hoc

```ts
// ❌ DON'T — process.env accessed directly, scattered across the codebase,
// with no validation that the value exists or is the right shape.
// This means a missing/misspelled env var fails LATE, at the exact
// moment the broken code path first runs — possibly in production,
// possibly days after deploy — rather than failing immediately at boot
// where it's cheap and obvious to diagnose.
const timeout = parseInt(process.env.API_TIMEOUT_MS || '5000'); // silently defaults on ANY problem, including a typo'd var name

// ✅ DO — one schema, parsed once, at application startup; the app
// refuses to boot at all if configuration is invalid, which is far
// preferable to booting in a broken, partially-configured state
const EnvSchema = z.object({
  API_TIMEOUT_MS: z.coerce.number().int().positive(),
  DATABASE_URL: z.url(),
  REDIS_URL: z.url(),
});
export const env = EnvSchema.parse(process.env); // throws at boot, loudly, if anything is missing or malformed
```

## Request-scoped providers — a performance trap to know about

NestJS supports request-scoped providers (`{ scope: Scope.REQUEST }`), which get a fresh instance per incoming request. This is sometimes genuinely necessary (e.g. a provider that needs the current request's tenant context baked in), but it has a real, easy-to-miss cost: **any provider that depends on a request-scoped provider becomes request-scoped too, transitively, all the way up the dependency graph** — including, potentially, your entire application if a commonly-injected provider is marked request-scoped without everyone realizing the consequence.

```text
❌ DON'T — mark a widely-injected, expensive-to-construct provider (like
   a database connection wrapper) as REQUEST scope "just to be safe,"
   without realizing every single thing that depends on it, directly or
   transitively, now gets reconstructed on every request — a real,
   measurable performance regression across the whole app.

✅ DO — default to singleton scope (NestJS's default) for everything.
   Reach for request scope only for the narrow provider that GENUINELY
   needs per-request state (e.g. holding the current tenant ID), and keep
   its dependents minimal and deliberate.
```

## API versioning

```text
❌ DON'T — change the meaning of an existing field or endpoint in place,
   silently, and hope every consumer updates at the same time.

✅ DO — for a breaking change, introduce it under a new version
   (URI versioning: /v2/orders, or header-based versioning, whichever
   this project has standardized on) and keep the old version
   functioning until every consumer (web, mobile — remembering mobile
   clients can lag for weeks, per 01-repository-architecture.md) has
   migrated, per an explicit, communicated deprecation timeline.
```

## Rate limiting

Every publicly reachable endpoint should have a rate limit appropriate to its sensitivity — an unauthenticated endpoint (login, password reset, signup) needs a stricter limit than an authenticated, already-trusted endpoint, because it's the primary target for abuse (credential stuffing, enumeration attacks).

```ts
// ✅ DO — explicit, endpoint-appropriate throttling
@Throttle({ default: { limit: 5, ttl: 60_000 } }) // 5 attempts per minute
@Post('auth/login')
async login(@Body() dto: LoginDto) { ... }
```

## Module lifecycle hooks

```ts
// ❌ DON'T — expensive setup work (opening a Kafka connection, warming a
// cache) done inline in a provider's constructor, where it can't be
// awaited and errors are hard to handle cleanly
@Injectable()
export class KafkaProducerService {
  constructor() {
    this.client.connect(); // fire-and-forget, no way to know if this failed before the app starts serving traffic
  }
}

// ✅ DO — NestJS's lifecycle hooks, which the framework awaits properly
// as part of application bootstrap/shutdown
@Injectable()
export class KafkaProducerService implements OnModuleInit, OnModuleDestroy {
  public async onModuleInit(): Promise<void> {
    await this.client.connect(); // app won't finish starting until this succeeds
  }
  public async onModuleDestroy(): Promise<void> {
    await this.client.disconnect(); // graceful shutdown, not an abrupt kill
  }
}
```

Graceful shutdown matters specifically for anything mid-flight during a deploy (`13-ci-cd-and-quality-gates.md`) — a service that's killed abruptly mid-request or mid-message-processing, with no chance to finish or cleanly hand off, is a direct source of the exact race conditions and inconsistent states this document spends so much effort elsewhere trying to prevent.

## Avoiding circular provider injection

```ts
// ❌ DON'T — two providers injecting each other directly (distinct from,
// but closely related to, the module-level circular dependency already
// covered in 01-repository-architecture.md) — NestJS will throw a clear
// error at boot, but the FIX matters: don't reach for forwardRef() as a
// default response to this error without asking why the cycle exists
@Injectable()
export class OrdersService {
  constructor(private readonly notifications: NotificationsService) {}
}
@Injectable()
export class NotificationsService {
  constructor(private readonly orders: OrdersService) {}
}

// ✅ DO — figure out which direction the dependency SHOULD actually
// flow, and remove the other one; usually one of the two doesn't
// actually need the full other service, just a narrow capability
// (Interface Segregation, 21-oop-and-solid-principles.md) or the
// relationship should be event-driven instead (01-repository-architecture.md)
```

## Health check endpoints

```ts
// ✅ DO — a real readiness check that verifies the app can actually
// serve traffic (12-observability-and-operations.md), not just that
// the HTTP server is listening
@Controller('health')
export class HealthController {
  public constructor(private readonly health: HealthCheckService, private readonly db: PrismaHealthIndicator, private readonly redis: RedisHealthIndicator) {}

  @Get('live')
  public liveness(): { status: 'ok' } {
    return { status: 'ok' }; // process is running — nothing more
  }

  @Get('ready')
  @HealthCheck()
  public readiness() {
    return this.health.check([
      () => this.db.pingCheck('database'),
      () => this.redis.pingCheck('redis'),
    ]);
  }
}
```

## Swagger/OpenAPI setup — generated, not maintained by hand

Building directly on `05-contracts-zod-api.md`'s "zod drives Swagger" rule, the actual bootstrap wiring:

```ts
// main.ts
const config = new DocumentBuilder()
  .setTitle('Orders API')
  .setVersion('1.0')
  .addBearerAuth()
  .build();
const document = SwaggerModule.createDocument(app, config); // built from the createZodDto-based controllers — no hand-written schema duplication
SwaggerModule.setup('api/docs', app, document);
```

Keep the Swagger UI disabled or authenticated in production if the API surface itself is not meant to be publicly browsable — treat the decision of "is our API documentation public" as a deliberate one, not a default left over from local development convenience.

## Testing a NestJS module in isolation

```ts
// ✅ DO — Nest's TestingModule, with only the providers actually needed
// for the unit under test, everything else mocked
describe('OrdersService', () => {
  let service: OrdersService;
  let repository: DeepMockProxy<OrdersRepository>;

  beforeEach(async () => {
    repository = mockDeep<OrdersRepository>();
    const module = await Test.createTestingModule({
      providers: [OrdersService, { provide: OrdersRepository, useValue: repository }],
    }).compile();
    service = module.get(OrdersService);
  });

  it('rejects an order over the credit limit', async () => { ... });
});
```

Don't spin up the entire `AppModule` for a unit test that only needs one service and its direct dependencies — that's an integration test wearing a unit test's clothing, and it's needlessly slow (`11-testing-vitest.md`'s mocking-strategy guidance).

## A full worked example — a complete feature module, every layer shown

Tying this entire document together, here is one complete, small feature module (canceling an order) shown across every layer, so the abstract layering guidance above has one concrete, end-to-end anchor to refer back to.

```ts
// modules/orders/schemas/cancel-order.schema.ts
export const CancelOrderSchema = z.object({ reason: z.string().min(1).max(500) });
export type CancelOrderDto = z.infer<typeof CancelOrderSchema>;

// modules/orders/domain/order-cancellation.policy.ts
export class OrderCancellationPolicy {
  public canCancel(order: Order): { allowed: true } | { allowed: false; reason: string } {
    if (order.status === 'delivered') return { allowed: false, reason: 'Cannot cancel a delivered order' };
    if (order.status === 'cancelled') return { allowed: false, reason: 'Order is already cancelled' };
    return { allowed: true };
  }
}

// modules/orders/infrastructure/prisma/orders.repository.ts
export class OrdersRepository extends PrismaBaseRepository<Order, OrderId, PrismaOrderRow> {
  public async cancel(id: OrderId, reason: string, cancelledBy: UserId): Promise<Order> {
    // atomic conditional update — race-condition safe per 08-database-prisma.md:
    // only actually cancels if the order is STILL in a cancellable state
    // at the moment this exact statement runs, not merely when it was
    // last read
    const result = await this.prisma.order.updateMany({
      where: { id, status: { notIn: ['delivered', 'cancelled'] }, isDeleted: false },
      data: { status: 'cancelled', cancellationReason: reason },
    });
    if (result.count === 0) throw new OrderNotCancellableError(id);
    return this.findById(id);
  }
}

// modules/orders/application/services/cancel-order.service.ts
export class CancelOrderService {
  public constructor(
    private readonly repository: OrdersRepository,
    private readonly policy: OrderCancellationPolicy,
    private readonly events: EventPublisher, // interface, not a concrete Kafka client — DIP, 21-oop-and-solid-principles.md
  ) {}

  public async execute(id: OrderId, dto: CancelOrderDto, user: AuthUser): Promise<Order> {
    const order = await this.repository.findById(id);
    if (!order) throw new OrderNotFoundError(id);

    const decision = this.policy.canCancel(order);
    if (!decision.allowed) throw new OrderNotEligibleError(decision.reason);

    const cancelled = await this.repository.cancel(id, dto.reason, user.id);
    await this.events.publish({ type: 'order.cancelled', payload: { orderId: id, reason: dto.reason } });
    return cancelled;
  }
}

// modules/orders/presentation/http/orders.controller.ts
@Controller('orders')
export class OrdersController {
  public constructor(private readonly cancelOrder: CancelOrderService) {}

  @Post(':id/cancel')
  @UseGuards(AuthGuard, PermissionGuard(Permission.ORDER_CANCEL), OwnershipGuard('order', 'customer'))
  public async cancel(
    @Param('id', new ZodValidationPipe(OrderIdSchema)) id: OrderId,
    @Body(new ZodValidationPipe(CancelOrderSchema)) dto: CancelOrderDto,
    @CurrentUser() user: AuthUser,
  ): Promise<OrderResponseDto> {
    return this.cancelOrder.execute(id, dto, user);
  }
}

// modules/orders/cancel-order.service.spec.ts
describe('CancelOrderService', () => {
  it('cancels a pending order', async () => { ... });
  it('rejects cancelling an already-delivered order', async () => {
    const service = createService({ order: buildOrder({ status: 'delivered' }) });
    await expect(service.execute(orderId, dto, user)).rejects.toThrow(OrderNotEligibleError);
  });
  it('publishes an order.cancelled event on success', async () => { ... });
  it('does not publish an event if the cancellation policy rejects it', async () => { ... });
});
```

Every one of this document's individual rules — thin controllers, a named policy class instead of inline logic, race-condition-safe repository writes, DIP-based event publishing, explicit access modifiers and return types throughout, tests covering the denial case specifically — is visible together in this one small, complete, realistic example. When in doubt about how a piece of backend code should be structured, this is the shape to match.

## Caching in the backend — a reference pattern

```ts
public async getRewardCatalog(organizationId: string): Promise<Reward[]> {
  const key = cacheKeys.rewardCatalog(organizationId);          // tenant is part of the key — never share across orgs
  const cached = await this.cache.get(key, RewardListSchema);   // re-validated on read: a stale/poisoned entry can't leak a bad shape
  if (cached) return cached;
  const fresh = await this.repository.listPublished(organizationId);
  await this.cache.set(key, fresh, REWARD_CATALOG_TTL_SECONDS);
  return fresh;
}

// invalidation lives next to the write that makes the cache stale
public async publish(...): Promise<Reward> {
  const published = await this.rewards.publish(id, orgId);
  await this.cache.delete(cacheKeys.rewardCatalog(orgId));      // same change that introduced the cache also introduced this line
  return published;
}
```

```text
❌ Cache key without the tenant → cross-tenant data leak.
❌ Cache with no TTL and no invalidation → permanent staleness bug.
❌ Cache read trusted without validation → a schema change deploys, old entries crash consumers.
✅ Tenant in key · explicit TTL · invalidation in the same PR · zod-validated reads · cache failure falls back to the database
   (a Redis outage degrades performance, it does not take the endpoint down — see 12 on SPOFs).
```

## Pagination response contract

```ts
export const PageMetaSchema = z.object({ page: z.number().int().positive(), pageSize: z.number().int().positive(), total: z.number().int().nonnegative(), totalPages: z.number().int().nonnegative() });
export const paginated = <TItem extends z.ZodType>(item: TItem) => z.object({ data: z.array(item), meta: PageMetaSchema });
```

Every list endpoint returns the same envelope, so one frontend table integration works for all of them. For very large or fast-changing data, use cursor pagination (`nextCursor`) and document why offset was not used.

## Idempotency keys at the HTTP layer

For any non-idempotent POST that a client may retry (create order, charge, submit), accept an `Idempotency-Key` header and store `(key, userId, requestHash) → response` for a bounded window. A repeated key with the same payload returns the stored response; the same key with a different payload returns a `409`/`422`. This protects against mobile retries, double-clicks, and gateway timeouts independent of any downstream provider's own idempotency.

## Global exception filter — reference

```ts
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  public catch(exception: Error, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const request = host.switchToHttp().getRequest<Request>();
    const mapped = mapToAppError(exception);                      // known errors → stable codes; anything else → INTERNAL_ERROR
    if (mapped.status >= HTTP_SERVER_ERROR_MIN) {
      this.logger.error({ event: 'http.unhandled', requestId: request.id, error: describeError(exception) }); // full detail, server-side only
    }
    response.status(mapped.status).json(ErrorResponseSchema.parse({
      code: mapped.code, message: mapped.publicMessage, details: mapped.safeDetails, requestId: request.id,
    }));                                                           // never the stack, never the raw provider message
  }
}
```

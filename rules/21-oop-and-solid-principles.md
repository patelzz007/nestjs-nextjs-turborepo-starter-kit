# 21 — OOP Fundamentals & SOLID Principles

This project leans toward composition, interfaces, and small explicit functions/services over deep class hierarchies — but classic OOP tools (inheritance, polymorphism, abstraction, encapsulation) are still the right choice in specific, narrow situations. This doc says when, with worked examples for each.

## Encapsulation — always

Every class hides its implementation details behind a deliberate public API (`00-non-negotiables.md`'s explicit access modifiers rule is encapsulation enforced at the language level).

```ts
// ❌ DON'T — every field and helper method is public by omission; callers
// can reach into internals that were never meant to be touched directly,
// and there's no way to change the internal implementation later without
// risking breaking something that depended on it
class OrdersService {
  repository: OrdersRepository;
  constructor(repository: OrdersRepository) { this.repository = repository; }
  assertWithinCreditLimit(dto) { ... }
  toEntity(dto) { ... }
  async place(dto) {
    this.assertWithinCreditLimit(dto);
    return this.repository.save(this.toEntity(dto));
  }
}

// ✅ DO — only what callers genuinely need is public; everything else is
// private and free to change without affecting anyone
export class OrdersService {
  public constructor(private readonly repository: OrdersRepository) {}

  public async place(dto: CreateOrderDto): Promise<Order> {
    this.assertWithinCreditLimit(dto);
    return this.repository.save(this.toEntity(dto));
  }

  private assertWithinCreditLimit(dto: CreateOrderDto): void { ... }
  private toEntity(dto: CreateOrderDto): Order { ... }
}
```

## Abstraction — when a stable contract genuinely exists

Define an interface/abstract contract when multiple concrete implementations genuinely exist or are genuinely expected (not hypothetically), and callers should depend on the contract rather than a specific implementation.

```ts
// ❌ DON'T — an interface with exactly one implementation and no credible
// reason to expect a second, adding a layer of indirection for nothing
interface UserGreeter {
  greet(user: User): string;
}
class DefaultUserGreeter implements UserGreeter {
  greet(user: User): string { return `Hello, ${user.name}`; }
}
// there is not now, nor will there ever plausibly be, a second implementation

// ✅ DO — a real abstraction point, where a second implementation genuinely
// exists (Stripe today, potentially another provider later)
export interface PaymentGateway {
  charge(input: ChargeInput): Promise<ChargeResult>;
  refund(input: RefundInput): Promise<RefundResult>;
}
export class StripePaymentGateway implements PaymentGateway { ... }
```

## Inheritance — narrow, "is-a" relationships with a stable shared contract only

Reach for inheritance when a genuine "is-a" relationship holds and the shared behavior is stable and unlikely to need per-subclass exceptions that fight the base class.

```ts
export abstract class PrismaBaseRepository<TEntity, TId, TRow> {
  protected constructor(protected readonly prisma: PrismaService) {}
  public abstract findById(id: TId): Promise<TEntity | null>;
  protected abstract toDomain(row: TRow): TEntity;
}
```

**This is not a contradiction of `00-non-negotiables.md`'s "don't create `BaseService`/`BaseController`/`UniversalManager`" rule** — it's the same rule applied consistently. The difference is scope and stability: a base repository's contract (`findById`, `save`, `delete`, `toDomain`) is genuinely identical in shape across every entity and doesn't grow feature-specific branches over time. A `BaseService` or `BaseController` almost always ends up accumulating `if (this.featureName === 'orders') { ... }`-style special cases, because "service" and "controller" aren't actually a shared behavioral contract — they're just a shared file-naming convention.

```ts
// ❌ DON'T — a base class that starts narrow and grows exceptions over time
export abstract class BaseController {
  protected handleRequest(req: Request): void {
    this.validate(req);
    this.authorize(req);
    // ...six months later:
    if (this.constructor.name === 'PaymentsController') {
      // special payment-specific step forced into the shared base
    }
  }
}

// ✅ DO — composition; each controller uses only what it needs, no forced
// shared shape that has to anticipate every future controller's needs
@Controller('payments')
export class PaymentsController {
  public constructor(
    private readonly validator: RequestValidator,
    private readonly authorizer: RequestAuthorizer,
    private readonly paymentsService: PaymentsService,
  ) {}
}
```

Prefer composition over inheritance whenever the relationship is "has-a"/"uses-a" rather than "is-a" — e.g. `OrdersService` *uses* a `PaymentGateway`, it doesn't *extend* one.

## Polymorphism — via interfaces, not via class hierarchies, in most of this codebase

Prefer interface-based polymorphism (multiple classes implementing the same TypeScript interface) over inheritance-based polymorphism (subclasses overriding a shared base class's methods).

```ts
// ❌ Avoid, unless there's a genuine shared, stable implementation to inherit
abstract class BaseEventPublisher {
  abstract publish(event: DomainEvent): Promise<void>;
}
class KafkaEventPublisher extends BaseEventPublisher { ... }

// ✅ Preferred — interface-based, composes better with dependency injection
export interface EventPublisher {
  publish(event: DomainEvent): Promise<void>;
}
export class KafkaEventPublisher implements EventPublisher { ... }
export class RabbitMqEventPublisher implements EventPublisher { ... }
```

Discriminated unions (`00-non-negotiables.md`) are frequently a better fit than either form of polymorphism for data/state modeling — reach for polymorphism when you're modeling *behavior* that varies by type, and discriminated unions when you're modeling *data* that varies by type.

## SOLID

### Single Responsibility Principle (SRP)

A class has one reason to change.

```ts
// ❌ DON'T — one class doing HTTP handling, business rules, AND persistence,
// so a change to any one of those three concerns requires editing this
// same file, and it's touched constantly for unrelated reasons
@Controller('orders')
export class OrdersController {
  @Post()
  async create(@Body() body: any) {
    if (body.total > 10000) throw new BadRequestException('too large'); // business rule
    return this.prisma.order.create({ data: body }); // persistence
  }
}

// ✅ DO — three separate reasons to change, three separate classes
@Controller('orders') export class OrdersController { /* HTTP concerns only */ }
export class OrderEligibilityPolicy { /* business rule concerns only */ }
export class OrdersRepository { /* persistence concerns only */ }
```

If a single class routinely gets touched for unrelated reasons, it's carrying more than one responsibility and should be split along `02-backend-nestjs.md`'s controller/service/repository lines.

### Open/Closed Principle (OCP)

Prefer designs where adding a new case means adding new code, not editing existing code.

```ts
// ❌ DON'T — every new status requires editing this function
function getStatusColor(status: string): string {
  if (status === 'pending') return 'yellow';
  if (status === 'shipped') return 'blue';
  if (status === 'delivered') return 'green';
  // adding 'cancelled' means coming back here and adding another line
}

// ✅ DO — open for extension (add an entry to the map), closed for
// modification (the lookup logic itself never changes)
const STATUS_COLORS: Record<OrderStatus, string> = {
  pending: 'yellow', shipped: 'blue', delivered: 'green', cancelled: 'red',
};
function getStatusColor(status: OrderStatus): string { return STATUS_COLORS[status]; }
```

A `Record<Status, Handler>` map or a discriminated-union `switch` with `assertNever` (`00-non-negotiables.md`) achieves the same thing for behavior, not just data.

### Liskov Substitution Principle (LSP)

Any concrete implementation of an interface/base class must be usable anywhere the interface/base is expected, without surprising callers.

```ts
// ❌ DON'T — FirebaseObjectStorage silently truncates oversized uploads
// instead of rejecting them, while S3ObjectStorage throws. Code written
// against the ObjectStorage interface behaves DIFFERENTLY depending on
// which implementation happens to be wired up — a Liskov violation.
class S3ObjectStorage implements ObjectStorage {
  async upload(input) { if (input.body.length > MAX) throw new FileTooLargeError(); ... }
}
class FirebaseObjectStorage implements ObjectStorage {
  async upload(input) { input.body = input.body.slice(0, MAX); ... } // silently truncates instead!
}

// ✅ DO — both implementations honor the same contract identically;
// swapping one for the other never changes correctness, only which
// provider's infrastructure is actually used
class FirebaseObjectStorage implements ObjectStorage {
  async upload(input) { if (input.body.length > MAX) throw new FileTooLargeError(); ... }
}
```

### Interface Segregation Principle (ISP)

Prefer several small, purpose-specific interfaces over one large interface that forces implementers to support methods they don't need.

```ts
// ❌ DON'T — forces every consumer/implementer to deal with all of this,
// even a consumer that only ever needs to look up a user by ID
interface UserGateway {
  findById(id: string): Promise<User | null>;
  create(input: CreateUserInput): Promise<User>;
  sendWelcomeEmail(userId: string): Promise<void>;
  syncToAnalytics(userId: string): Promise<void>;
}

// ✅ DO — split by actual consumer need
interface UserReader { findById(id: string): Promise<User | null>; }
interface UserWriter { create(input: CreateUserInput): Promise<User>; }
// a service that only ever reads users depends on UserReader alone,
// and is untouched by changes to how users get created
```

### Dependency Inversion Principle (DIP)

High-level modules (application services) depend on abstractions (interfaces/ports), not on low-level modules (concrete Prisma repositories, a specific payment SDK, a specific storage SDK) directly — and both sides depend on the shared interface.

```ts
// ❌ DON'T — OrdersService is directly coupled to Prisma; testing it
// requires a real (or heavily mocked) Prisma client, and switching ORMs
// later means rewriting every service, not just the repository layer
export class OrdersService {
  public constructor(private readonly prisma: PrismaClient) {}
  public async create(dto: CreateOrderDto): Promise<Order> {
    return this.prisma.order.create({ data: dto }); // direct, concrete dependency
  }
}

// ✅ DO — OrdersService depends on an ABSTRACTION; the concrete Prisma
// implementation is injected, and can be swapped/mocked freely
export class OrdersService {
  public constructor(private readonly repository: Repository<Order, OrderId>) {}
  public async create(dto: CreateOrderDto): Promise<Order> {
    return this.repository.save(this.toEntity(dto));
  }
}
```

This is why `OrdersService` takes a `Repository<Order, OrderId>`-shaped dependency via constructor injection rather than instantiating `PrismaClient` itself, and why `PaymentGateway`/`ObjectStorage` are interfaces the concrete Stripe/S3 classes implement, not the other way around. NestJS's DI container is the mechanism; DIP is the reason to use it deliberately rather than just because "that's how Nest works."

## Putting it together

Most of this codebase's classes only need SRP + encapsulation + DIP applied well — that alone eliminates the majority of real-world design problems. Reach for OCP/ISP/LSP-driven interface design specifically at genuine extension points (payment providers, storage providers, event publishers, repositories) where a second implementation is real or clearly coming — not as a checklist to apply uniformly to every class regardless of whether it has more than one implementation.

## Common design patterns — when they earn their place here

Design patterns are tools for specific, recurring problems, not a checklist to apply for their own sake. Each one below is genuinely useful in this codebase in the specific situation described — and actively harmful as decoration outside it.

### Strategy pattern

Use when you have a family of interchangeable algorithms/behaviors selected at runtime, and the alternative is a growing conditional.

```ts
// ❌ DON'T — a pricing calculation with a branching conditional that
// grows every time a new pricing model is added
function calculatePrice(order: Order, pricingModel: string): number {
  if (pricingModel === 'standard') { ... }
  if (pricingModel === 'wholesale') { ... }
  if (pricingModel === 'promotional') { ... } // this function keeps growing forever
}

// ✅ DO — each strategy is its own class implementing a shared interface;
// adding a new pricing model means adding a new class, not editing this one
// (this is also the Open/Closed Principle from earlier in this doc, applied concretely)
interface PricingStrategy {
  calculate(order: Order): number;
}
class StandardPricing implements PricingStrategy { calculate(order: Order): number { ... } }
class WholesalePricing implements PricingStrategy { calculate(order: Order): number { ... } }

const strategies: Record<PricingModel, PricingStrategy> = {
  standard: new StandardPricing(),
  wholesale: new WholesalePricing(),
};
function calculatePrice(order: Order, model: PricingModel): number {
  return strategies[model].calculate(order);
}
```

### Factory pattern

Use when constructing an object is genuinely non-trivial (it depends on runtime configuration, or needs to select among several concrete implementations) — not for every single object creation, which is unnecessary ceremony for a plain `new SomeClass()`.

```ts
// ✅ DO — a factory earns its place when construction genuinely varies
export class ObjectStorageFactory {
  public static create(config: StorageConfig): ObjectStorage {
    switch (config.provider) {
      case 's3': return new S3ObjectStorage(config);
      case 'firebase': return new FirebaseObjectStorage(config);
    }
  }
}
```

```ts
// ❌ DON'T — a "factory" for something with no real variation, adding
// pure ceremony
class OrderFactory {
  static create(dto: CreateOrderDto): Order {
    return { ...dto, id: crypto.randomUUID() }; // this is just... a constructor. Use one.
  }
}
```

### Decorator pattern

Use when you need to layer additional behavior around an existing interface implementation without modifying it — NestJS's own `@UseInterceptors`/guards are effectively this pattern already built into the framework; reach for a manual decorator class only when you need the same layering OUTSIDE of what Nest's own DI/interceptor system already covers.

```ts
// ✅ DO — a caching decorator wrapping any ObjectStorage implementation,
// without either the decorator or the wrapped implementation needing to
// know about each other's internals
class CachingObjectStorage implements ObjectStorage {
  constructor(private readonly inner: ObjectStorage, private readonly cache: Cache) {}
  async getSignedDownloadUrl(key: string, ttl: number): Promise<string> {
    const cached = await this.cache.get(key);
    if (cached) return cached;
    const url = await this.inner.getSignedDownloadUrl(key, ttl);
    await this.cache.set(key, url, ttl);
    return url;
  }
}
```

### Observer pattern

In this codebase, the observer pattern is almost always better served by the event-driven infrastructure already covered in `09-messaging-and-jobs.md` (Kafka/RabbitMQ events, NestJS's own `EventEmitter`) than by a hand-rolled observer implementation — don't build a custom pub/sub mechanism when the project already has one.

## When NOT to reach for a pattern

```text
❌ DON'T look for an excuse to use a pattern because you just read about
   it — a pattern applied where the underlying problem (multiple
   interchangeable implementations, non-trivial construction, layered
   behavior) doesn't actually exist just adds a layer of indirection
   someone else has to trace through, for zero real benefit. This is the
   OOP-specific instance of 00-non-negotiables.md's "no speculative
   abstractions" rule, and it's worth restating here because design
   patterns, specifically, are the most common vehicle for this mistake
   — they FEEL like "good engineering" independent of whether they
   solve a problem that's actually present.

✅ DO start with the plainest possible code (a function, a plain class,
   a simple conditional) and reach for a named pattern only once the
   specific problem it solves has genuinely, concretely shown up.
```

## Composition root — where dependency wiring actually happens

```ts
// ❌ DON'T — scatter manual `new SomeConcreteClass(...)` construction
// throughout business logic, deep inside services, which hardwires a
// concrete dependency exactly where DIP (above) says it shouldn't be
export class OrdersService {
  private readonly paymentGateway = new StripePaymentGateway(process.env.STRIPE_KEY); // constructed deep inside, not injected
  public async charge(order: Order): Promise<void> {
    await this.paymentGateway.charge({ ... });
  }
}

// ✅ DO — construction/wiring happens in ONE place (NestJS's module
// system acts as this composition root), and everywhere else simply
// receives already-constructed dependencies via injection
@Module({
  providers: [
    { provide: 'PaymentGateway', useClass: StripePaymentGateway },
    OrdersService,
  ],
})
export class OrdersModule {}

export class OrdersService {
  public constructor(@Inject('PaymentGateway') private readonly paymentGateway: PaymentGateway) {}
}
```

Knowing "where does construction happen" as a single, predictable answer (the module's provider registration) rather than scattered `new` calls throughout the codebase is a large part of what makes swapping an implementation (for a test double, or for a genuinely different provider later) actually easy in practice, not just in theory.

## God objects — a smell across every principle at once

A "god object" (or god service/god component) — one class/file that's grown to know about and do far more than its name suggests, accumulating responsibilities over many small, individually-reasonable-seeming additions — is usually visible as a SRP, ISP, and often DIP violation all at once, and is one of the most common real architectural failures in a growing codebase, precisely because no single change that grew it looked wrong at the time.

```text
❌ DON'T — an OrdersService that, eighteen months in, also sends emails,
   talks to the payment gateway directly, manages inventory
   reservations, and generates PDF invoices — each addition individually
   looked like "it's related to orders, might as well go here."

✅ DO — when a class's list of responsibilities can no longer be
   summarized in one clear sentence, that's the signal to split it along
   the actual distinct responsibilities (SRP, above) — a
   PaymentService, an InventoryReservationService, an
   InvoiceGenerationService, each depended on (DIP) by OrdersService
   rather than reimplemented inside it.
```

Catching this early, in review, before a class becomes genuinely hard to split, is far cheaper than untangling it later — treat "this service just grew one more, seemingly small, unrelated method" as worth a second look every time, not just when the file has already become unmanageably large.

## Anemic domain models — the opposite failure mode

```text
❌ DON'T swing so far toward "just use plain functions and services" that
   every domain type becomes a bare data bag with zero behavior, and
   EVERY operation on it lives in a separate service — this isn't
   inherently wrong (it's a legitimate, common style, and much of this
   codebase's guidance leans this direction deliberately), but taken to
   an extreme it can scatter validation/invariant logic for one concept
   across many unrelated services with no natural home, making it easy
   for one of them to forget a rule the others enforce.

✅ DO — for a genuinely rich domain concept with real, self-contained
   invariants (e.g. "an Order's total can never be negative, and its
   status transitions follow a specific state machine"), it's
   reasonable for the domain entity itself to own and enforce that
   narrow set of invariants directly, even in an otherwise
   service-oriented codebase — the goal is invariants that are
   impossible to violate from ANYWHERE, not a specific dogma about
   where the enforcing code must live.
```

## Do / Don't quick pairs

```ts
// ❌ static/global mutable state as a hidden dependency
class Pricing { static currentTaxRate = 0.08; }
// ✅ injected, explicit dependency
class Pricing { public constructor(private readonly tax: TaxRateProvider) {} }
```

```ts
// ❌ leaking a mutable internal collection
public getItems(): Item[] { return this.items; }
// ✅ expose a read-only view (encapsulation)
public getItems(): readonly Item[] { return this.items; }
```

```ts
// ❌ "manager"/"helper"/"util" class names that reveal no responsibility
class OrderManager {}
// ✅ names that state one responsibility
class OrderCancellationPolicy {}   class InvoicePdfRenderer {}   class RewardsRepository {}
```

```ts
// ❌ temporal coupling: methods that must be called in a secret order
svc.init(); svc.load(); svc.run();
// ✅ a constructor/factory that returns a ready-to-use object; invalid states unrepresentable
const svc = await Service.create(config);
```

```ts
// ❌ constructor doing I/O
constructor() { this.connection = connectNow(); }
// ✅ lifecycle hooks (onModuleInit) or an async factory
```

## Choosing between a class and a function

```text
Use a CLASS when: it holds injected dependencies (NestJS providers), has a lifecycle, or implements an interface for polymorphism.
Use a FUNCTION when: it is pure, stateless, and takes what it needs as arguments (formatters, mappers, policies without deps).
❌ A class with one static method and no state — that's a function in a costume.
```

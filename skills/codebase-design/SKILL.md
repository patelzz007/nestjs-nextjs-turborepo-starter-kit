# Skill: Design Cohesive, Reusable Modules

## When to use
Use when adding or changing shared packages, module boundaries, interfaces, base classes, adapters, providers, strategies, or extension points. Read `01-repository-architecture.md`, `21-oop-and-solid-principles.md`, and `00-non-negotiables.md` first.

## Design vocabulary
- **Module:** a cohesive unit that owns a responsibility and hides implementation details.
- **Interface/contract:** the smallest explicit surface consumers need.
- **Depth:** how much useful behavior a module provides relative to the complexity of its interface.
- **Seam:** a deliberate boundary where implementations can vary without spreading that variation through consumers.
- **Adapter:** translates an external/provider-specific contract into the application's contract.
- **Policy:** business-specific decision owned by the relevant domain/context, not generic infrastructure.

## Workflow

1. Identify the behavior and its true owner.
2. Enumerate real callers and their overlapping needs; inspect actual code, not hypothetical consumers.
3. Separate invariant behavior from caller-specific policy.
4. Identify the smallest stable contract that serves the real callers.
5. Check dependency direction and package runtime constraints.
6. Decide whether composition, a function, interface, adapter, strategy, or no abstraction is simplest.
7. Keep provider SDKs, Prisma models, transport DTOs, and app-specific policy behind the appropriate boundary.
8. Make supported variation explicit and preserve validation/security/data invariants for every implementation.
9. Test the contract and at least one meaningful implementation path.
10. Document compatibility and extension behavior when the contract is public or shared.

## Reject these designs unless concrete evidence justifies them
- Base classes that accumulate feature-specific overrides.
- Universal CRUD/service/manager abstractions.
- Generic factories with one implementation and no stable variation requirement.
- A catch-all `utils` module with unrelated responsibilities.
- Shared packages importing from an app.
- A lowest-common-denominator interface that hides required capabilities or leaks provider types.
- Plugin registries, hook systems, or configuration DSLs for speculative future needs.
- An abstraction that requires consumers to know its internal lifecycle or coordinate multiple unrelated methods.

## Decision test
Choose an abstraction only when it reduces total complexity, has real consumers, has a stable contract, preserves useful types, and can be tested independently. Otherwise keep the code local and revisit when a second real use case demonstrates the commonality.

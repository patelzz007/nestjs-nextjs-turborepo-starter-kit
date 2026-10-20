# Bounded contexts

Each context under `src/contexts/` follows the same layout. Create only the folders the context uses.

```text
contexts/<context>/
  <context>.module.ts
  public-api.ts
  domain/            aggregates, entities, value objects, events, errors, policies, repository interfaces
  application/       application services (simple CRUD) or commands/queries
  infrastructure/    Prisma repositories, scope factory, adapters
  presentation/http/ controllers
```

Other contexts import only `public-api.ts`.

## References

- Simple path (application service, no command per endpoint): `contexts/catalog/`. Product and sample-category. Every method takes the actor first and runs in `CATALOG_UNIT_OF_WORK` under `catalog.product_catalog.read` / `catalog.product_catalog.write`, because those tables are bypass-only.
- CQRS path: `contexts/rewards/domain/aggregates/reward.aggregate.ts` and `application/commands/auto-publish-due-rewards/`. The auto-publish job dispatches `AutoPublishDueRewardsCommand` through `SystemCommandDispatcher`.

Which path to use is the decision tree in `rules/23-quick-reference-decision-trees.md`.

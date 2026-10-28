/**
 * The ONLY file other contexts may import from tenants (plan §6.4).
 *
 * `TenantsModule` (tenants.module.ts) is the composition module, mounted by `AppModule`
 * only and deliberately not exported here: contexts import `TenantAccessModule`, a leaf, so
 * importing tenants' tokens never drags the composition graph (and identity) in.
 *
 * - `MERCHANT_ACCESS` (`MerchantAccessPort`, declared once in `platform/application/ports/authorization.port.ts`): the merchant capability gate with
 *   the caller's store scope; every capability decision writes its `authorize.*`
 *   tenant audit row. Provided by `TenantAccessModule`.
 * - `TENANT_READ` (`TenantReadPort`): batched display data (name +
 *   logo image sources) and owner user ids. Provided by `TenantAccessModule`.
 * - `createTenantsTransactionalPorts(db)`: `MerchantPosSettingsPort`, `CustomerStandingPort`
 *   (does the tenant operate, which customers did it ban) and a tenant audit writer bound to YOUR
 *   unit-of-work transaction. Only your
 *   `infrastructure/` (scope factory) may call it.
 * - `TENANT_FILE_ACCESS` (`TenantFileAccessPort`): the access rule of an
 *   tenant-owned file category (current membership + capability), for
 *   contexts that own such a category (rewards: REWARD_IMAGE).
 * - `API_KEY_CAPABILITIES` (`ApiKeyCapabilitiesPort`), `LOCATION_CLOSURE_FACTORY`
 *   (`LocationClosureFactory`) and `REDEMPTION_CUSTOMER_FACTORY` (`RedemptionCustomerFactory`):
 *   ports tenants CONSUMES and pos implements (pos provides them globally), so tenants never imports pos.
 * - `TENANT_AUDIT` (`TenantAuditPort`): for services that already
 *   hold a transaction (tenant encryption, support access, files). Provided by
 *   `TenantAuditModule` (also re-exported by `TenantAccessModule`).
 */
export type { TenantDisplayData, TenantReadPort } from "./application/ports/tenant-read.port";
export type { TenantExistencePort } from "./application/ports/tenant-existence.port";
export type { MerchantPosSettingsPort, TenantsTransactionalPorts, TillTenantFacts } from "./application/ports/merchant-pos-settings.port";
export type { CustomerStandingPort } from "./application/ports/customer-standing.port";
export type { ApiKeyCapabilitiesPort } from "./application/ports/api-key-capabilities.port";
export type { TenantAuditEntry, TenantAuditMetadata, TenantAuditPort, TenantAuditWriter } from "./application/ports/tenant-audit.port";
export type { TenantFileAccessPort, TenantFileCapabilities } from "./application/ports/tenant-file-access.port";
export {
	API_KEY_CAPABILITIES,
	MERCHANT_ACCESS,
	TENANT_AUDIT,
	TENANT_FILE_ACCESS,
	TENANT_READ,
	LOCATION_CLOSURE_FACTORY,
	REDEMPTION_CUSTOMER_FACTORY,
} from "./application/ports/tenants.tokens";
export type { LocationClosureFactory, RedemptionCustomerFactory } from "./infrastructure/persistence/tenants-scope.factory";
export { TenantsDomainErrorCodeSchema, type TenantsDomainErrorCode } from "./domain/errors/tenants.errors";
export { MembershipInactiveError, TenantBannedError, TenantRouteNotActiveError, TenantSuspendedError } from "./domain/errors/tenants.errors";
export { decideTenantLifecycle, type TenantLifecycleRouteKind } from "./domain/policies/tenant-lifecycle.policy";
export { TENANT_LIFECYCLE_ROUTE_KEY } from "./presentation/http/tenant-lifecycle-route.decorator";
export { TenantAccessModule } from "./infrastructure/tenant-access.module";
export { TenantAuditModule } from "./infrastructure/audit/tenant-audit.module";
export { createTenantAuditPort, type TenantAuditTransaction } from "./infrastructure/audit/tenant-audit.adapter";
export { createTenantsTransactionalPorts } from "./infrastructure/persistence/tenants-transactional-ports";

// ── Helpers the seed and authorization's policy repository use ──────────────
// The seed writes tenant audit rows outside Nest; the policy control plane maps a membership's location scope.
export { TenantAuditService } from "./infrastructure/audit/tenant-audit.adapter";
export { mapMembershipLocationScope } from "./infrastructure/persistence/tenant-membership.mapper";

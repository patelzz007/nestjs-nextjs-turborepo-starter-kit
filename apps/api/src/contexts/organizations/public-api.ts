/**
 * The ONLY file other contexts may import from organizations (plan §6.4).
 *
 * `OrganizationsModule` (organizations.module.ts) is the composition module, mounted by `AppModule`
 * only and deliberately not exported here: contexts import `OrganizationAccessModule`, a leaf, so
 * importing organizations' tokens never drags the composition graph (and identity) in.
 *
 * - `MERCHANT_ACCESS` (`MerchantAccessPort`): the merchant capability gate with
 *   the caller's store scope; every Cedar decision writes its `authorize.*`
 *   organization audit row. Provided by `OrganizationAccessModule`.
 * - `ORGANIZATION_READ` (`OrganizationReadPort`): batched display data (name +
 *   logo image sources) and owner user ids. Provided by `OrganizationAccessModule`.
 * - `createOrganizationsTransactionalPorts(db)`: `MerchantPosSettingsPort` and an
 *   organization audit writer bound to YOUR unit-of-work transaction. Only your
 *   `infrastructure/` (scope factory) may call it.
 * - `ORGANIZATION_FILE_ACCESS` (`OrganizationFileAccessPort`): the access rule of an
 *   organization-owned file category (current membership + capability), for
 *   contexts that own such a category (rewards: REWARD_IMAGE).
 * - `API_KEY_CAPABILITIES` (`ApiKeyCapabilitiesPort`) and `STORE_CLOSURE_FACTORY`
 *   (`StoreClosureFactory`): ports organizations CONSUMES and pos implements (pos
 *   provides them globally), so organizations never imports pos.
 * - `ORGANIZATION_AUDIT` (`OrganizationAuditPort`): for services that already
 *   hold a transaction (tenant encryption, support access, files). Provided by
 *   `OrganizationAuditModule` (also re-exported by `OrganizationAccessModule`).
 */
export type { MerchantAccessGrant, MerchantAccessPort, MerchantAccessRequest } from "./application/ports/merchant-access.port";
export type { OrganizationDisplayData, OrganizationReadPort } from "./application/ports/organization-read.port";
export type { OrganizationExistencePort } from "./application/ports/organization-existence.port";
export type { MerchantPosSettingsPort, OrganizationsTransactionalPorts, TillOrganizationFacts } from "./application/ports/merchant-pos-settings.port";
export type { ApiKeyCapabilitiesPort } from "./application/ports/api-key-capabilities.port";
export type { OrganizationAuditEntry, OrganizationAuditMetadata, OrganizationAuditPort, OrganizationAuditWriter } from "./application/ports/organization-audit.port";
export type { OrganizationFileAccessPort, OrganizationFileCapabilities } from "./application/ports/organization-file-access.port";
export {
	API_KEY_CAPABILITIES,
	MERCHANT_ACCESS,
	ORGANIZATION_AUDIT,
	ORGANIZATION_FILE_ACCESS,
	ORGANIZATION_READ,
	STORE_CLOSURE_FACTORY,
} from "./application/ports/organizations.tokens";
export type { StoreClosureFactory } from "./infrastructure/persistence/organizations-scope.factory";
export { OrganizationsDomainErrorCodeSchema, type OrganizationsDomainErrorCode } from "./domain/errors/organizations.errors";
export { OrganizationAccessModule } from "./infrastructure/organization-access.module";
export { OrganizationAuditModule } from "./infrastructure/audit/organization-audit.module";
export { createOrganizationAuditPort, type OrganizationAuditTransaction } from "./infrastructure/audit/organization-audit.adapter";
export { createOrganizationsTransactionalPorts } from "./infrastructure/persistence/organizations-transactional-ports";

// ── Helpers the seed and authorization's policy repository use ──────────────
// The seed writes organization audit rows outside Nest; the policy control plane maps a membership's location scope.
export { OrganizationAuditService } from "./infrastructure/audit/organization-audit.adapter";
export { mapMembershipLocationScope } from "./infrastructure/persistence/organization-membership.mapper";

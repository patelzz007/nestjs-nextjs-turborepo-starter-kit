import type { SystemOperationName } from "../../../../platform/application/system-operation-names";

/** Injection tokens of the tenants context. */
export const TENANTS_UNIT_OF_WORK = Symbol("TENANTS_UNIT_OF_WORK");
export const MERCHANT_ACCESS = Symbol("MERCHANT_ACCESS");
export const TENANT_DIRECTORY = Symbol("TENANT_DIRECTORY");
export const TENANT_READ = Symbol("TENANT_READ");
export const TENANT_AUDIT = Symbol("TENANT_AUDIT");
export const TENANT_POLICY = Symbol("TENANT_POLICY");
export const TENANT_EMAILS = Symbol("TENANT_EMAILS");
export const INVITE_TOKENS = Symbol("INVITE_TOKENS");
export const KYB_FILE_ACCESS = Symbol("KYB_FILE_ACCESS");
/** {@link ApiKeyCapabilitiesPort}: provided by pos (it owns API keys), consumed by the merchant capability gate. */
export const API_KEY_CAPABILITIES = Symbol("API_KEY_CAPABILITIES");
/** `StoreClosureFactory`: provided by pos (it owns terminals and keys), bound to the store-closure transaction. */
export const STORE_CLOSURE_FACTORY = Symbol("STORE_CLOSURE_FACTORY");
export const TENANT_CONTEXT_READ = Symbol("TENANT_CONTEXT_READ");
export const TEAM_READ = Symbol("TEAM_READ");
export const MERCHANT_ADMIN_READ = Symbol("MERCHANT_ADMIN_READ");
export const KYB_READ = Symbol("KYB_READ");
export const TENANTS_SCOPE_FACTORY = Symbol("TENANTS_SCOPE_FACTORY");
/** {@link TenantFileAccessPort}: builds the access rule of a tenant-owned file category. */
export const TENANT_FILE_ACCESS = Symbol("TENANT_FILE_ACCESS");

/** A platform admin approves or rejects a merchant's KYB: the route and its command. */
export const KYB_ADMIN_DECIDE_OPERATION: SystemOperationName = "tenant.kyb.admin_decide";

/** A platform admin adds a location for a merchant: the route and its command. */
export const LOCATION_ADMIN_CREATE_OPERATION: SystemOperationName = "tenant.location.admin_create";

/** A platform admin lists location requests across tenants: the route and its read. */
export const LOCATION_ADMIN_LIST_OPERATION: SystemOperationName = "tenant.location.admin_list";

/** A platform admin approves or rejects a location request: the route and its command. */
export const LOCATION_ADMIN_REVIEW_OPERATION: SystemOperationName = "tenant.location.admin_review";

/** A platform admin reads merchants and their KYB evidence across tenants: the routes and their reads. */
export const MERCHANT_ADMIN_READ_OPERATION: SystemOperationName = "tenant.merchant.admin_read";

/** A platform admin invites a merchant, provisioning its tenant: the route and its command. */
export const PROVISION_ADMIN_MERCHANT_INVITE_OPERATION: SystemOperationName = "tenant.provision.admin_merchant_invite";

/** A platform admin provisions a tenant from a platform invite: the route and its command. */
export const PROVISION_PLATFORM_INVITE_OPERATION: SystemOperationName = "tenant.provision.platform_invite";

/** The `tenant.invitation.resolve_token` system operation, named once for every route and adapter that runs under it. */
export const TENANT_INVITATION_RESOLVE_TOKEN_OPERATION: SystemOperationName = "tenant.invitation.resolve_token";

/** The `tenant.invitation.accept_merchant_onboarding` system operation, named once for every route and adapter that runs under it. */
export const TENANT_INVITATION_ACCEPT_MERCHANT_ONBOARDING_OPERATION: SystemOperationName = "tenant.invitation.accept_merchant_onboarding";

/** The `tenant.invitation.submit_onboarding_documents` system operation, named once for every route and adapter that runs under it. */
export const TENANT_INVITATION_SUBMIT_ONBOARDING_DOCUMENTS_OPERATION: SystemOperationName = "tenant.invitation.submit_onboarding_documents";

/** The `tenant.invitation.register_and_accept` system operation, named once for every route and adapter that runs under it. */
export const TENANT_INVITATION_REGISTER_AND_ACCEPT_OPERATION: SystemOperationName = "tenant.invitation.register_and_accept";

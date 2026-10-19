/** Injection tokens of the organizations context. */
export const ORGANIZATIONS_UNIT_OF_WORK = Symbol("ORGANIZATIONS_UNIT_OF_WORK");
export const MERCHANT_ACCESS = Symbol("MERCHANT_ACCESS");
export const ORGANIZATION_DIRECTORY = Symbol("ORGANIZATION_DIRECTORY");
export const ORGANIZATION_READ = Symbol("ORGANIZATION_READ");
export const ORGANIZATION_AUDIT = Symbol("ORGANIZATION_AUDIT");
export const TENANT_POLICY = Symbol("TENANT_POLICY");
export const ORGANIZATION_EMAILS = Symbol("ORGANIZATION_EMAILS");
export const INVITE_TOKENS = Symbol("INVITE_TOKENS");
export const KYB_FILE_ACCESS = Symbol("KYB_FILE_ACCESS");
/** {@link ApiKeyCapabilitiesPort}: provided by pos (it owns API keys), consumed by the merchant capability gate. */
export const API_KEY_CAPABILITIES = Symbol("API_KEY_CAPABILITIES");
/** `StoreClosureFactory`: provided by pos (it owns terminals and keys), bound to the store-closure transaction. */
export const STORE_CLOSURE_FACTORY = Symbol("STORE_CLOSURE_FACTORY");
export const ORGANIZATION_CONTEXT_READ = Symbol("ORGANIZATION_CONTEXT_READ");
export const TEAM_READ = Symbol("TEAM_READ");
export const MERCHANT_ADMIN_READ = Symbol("MERCHANT_ADMIN_READ");
export const KYB_READ = Symbol("KYB_READ");
export const ORGANIZATIONS_SCOPE_FACTORY = Symbol("ORGANIZATIONS_SCOPE_FACTORY");
/** {@link OrganizationFileAccessPort}: builds the access rule of an organization-owned file category. */
export const ORGANIZATION_FILE_ACCESS = Symbol("ORGANIZATION_FILE_ACCESS");

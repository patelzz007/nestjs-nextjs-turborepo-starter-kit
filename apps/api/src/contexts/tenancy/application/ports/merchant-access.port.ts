/**
 * The merchant capability gate tenants implements (plan §5.9). The
 * interface stays declared in `platform/application/ports/authorization.port.ts`,
 * where every consumer already imports it (the platform may not import
 * contexts, so it cannot re-export from here); tenants owns the adapter
 * and the `MERCHANT_ACCESS` token.
 */
export type { MerchantAccessGrant, MerchantAccessPort, MerchantAccessRequest } from "../../../../platform/application/ports/authorization.port";

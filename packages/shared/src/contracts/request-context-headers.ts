/**
 * Headers the merchant console and POS clients send on every API call, naming the tenant and the
 * store (location) the caller is working in. They are information only for now: the API selects,
 * authorizes and scopes nothing from them (the tenant comes from the route or the API key, a
 * location from the route, the query or the body). What they should do is still to be decided.
 */
export const TENANT_ID_HEADER = "X-Tenant-Id";

/** See {@link TENANT_ID_HEADER}: the store the caller is working in, when one store is chosen. */
export const LOCATION_ID_HEADER = "X-Location-Id";

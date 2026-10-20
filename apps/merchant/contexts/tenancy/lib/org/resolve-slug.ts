import { TenantSlugSchema, UuidParamSchema } from "@workspace/shared";

/** True when `value` is a human slug — not a UUID accidentally used as a tenant path segment. */
export function isCanonicalTenantSlug(value: string): boolean {
	if (UuidParamSchema.safeParse(value).success) {
		return false;
	}
	return TenantSlugSchema.safeParse(value).success;
}

/** True when `value` can name a tenant in a route: its slug or its id. Anything else names none. */
export function isTenantRouteKey(value: string): boolean {
	return isCanonicalTenantSlug(value) || UuidParamSchema.safeParse(value).success;
}

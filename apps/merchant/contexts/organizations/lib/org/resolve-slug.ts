import { OrganizationSlugSchema, UuidParamSchema } from "@workspace/shared";

/** True when `value` is a human slug — not a UUID accidentally used as a tenant path segment. */
export function isCanonicalOrganizationSlug(value: string): boolean {
	if (UuidParamSchema.safeParse(value).success) {
		return false;
	}
	return OrganizationSlugSchema.safeParse(value).success;
}

/** True when `value` can name an organization in a route: its slug or its id. Anything else names none. */
export function isOrganizationRouteKey(value: string): boolean {
	return isCanonicalOrganizationSlug(value) || UuidParamSchema.safeParse(value).success;
}

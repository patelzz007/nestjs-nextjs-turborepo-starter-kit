import { parsePermissionSlug, type CapabilitySlug } from "@workspace/shared";

/** The session's grants, indexed once so repeated checks stay cheap. */
export interface GrantedCapabilities {
	readonly slugs: ReadonlySet<string>;
}

/** Indexes a capability list once so repeated checks stay cheap. */
export function createGrantedCapabilities(capabilities: readonly CapabilitySlug[]): GrantedCapabilities {
	return { slugs: new Set<string>(capabilities) };
}

/**
 * True when `required` is held: the exact capability. There is no catch-all action (ADR 067 retired
 * `MANAGE`), so holding one verb on a resource never implies another.
 */
export function isCapabilityGranted(granted: GrantedCapabilities, required: CapabilitySlug): boolean {
	return granted.slugs.has(required);
}

/**
 * Config-time slug check: platform slugs must resolve to a known
 * `(action, resource)` pair so typos such as `platform:product.lsit` fail
 * at load instead of silently denying. Other namespaces are validated by
 * `CapabilitySlugSchema`'s shape only (their catalog is database-driven).
 */
export function isKnownPermissionSlug(slug: string): boolean {
	if (slug.startsWith("platform:")) {
		return parsePermissionSlug(slug) !== null;
	}
	return true;
}

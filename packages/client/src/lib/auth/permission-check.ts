import { parsePermissionSlug, permissionSatisfies, type CapabilitySlug, type PermissionPair } from "@workspace/shared";

/**
 * Pre-indexed session grants: raw slugs for exact lookups plus the parsed
 * platform `(action, resource)` pairs used for `MANAGE` implication.
 */
export interface GrantedCapabilities {
	readonly slugs: ReadonlySet<string>;
	readonly pairs: readonly PermissionPair[];
}

/** Indexes a capability list once so repeated checks stay cheap. */
export function createGrantedCapabilities(capabilities: readonly CapabilitySlug[]): GrantedCapabilities {
	const pairs: PermissionPair[] = [];
	for (const slug of capabilities) {
		const pair = parsePermissionSlug(slug);
		if (pair !== null) {
			pairs.push(pair);
		}
	}
	return { slugs: new Set<string>(capabilities), pairs };
}

/**
 * True when `required` is held directly, or implied by a held platform
 * permission (`MANAGE` on the same resource implies every action on it).
 * Non-platform slugs (e.g. `merchant:*`) only match exactly.
 */
export function isCapabilityGranted(granted: GrantedCapabilities, required: CapabilitySlug): boolean {
	if (granted.slugs.has(required)) {
		return true;
	}
	const requiredPair = parsePermissionSlug(required);
	if (requiredPair === null) {
		return false;
	}
	return granted.pairs.some((held) => permissionSatisfies(held, requiredPair));
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

// Types only: building the ability (`new Ability(abilityRules(…))`) happens in the apps' ability providers
// (`@workspace/client`'s and mobile's), so CASL's code is loaded only by pages that mount one — never by every page
// that imports this package.
import type { Ability, RawRuleOf } from "@casl/ability";

import type { CapabilitySlug } from "../contexts/authorization/schemas/capabilities";
import type { PermissionAction, PermissionResource } from "../contexts/authorization/schemas/permission-enums";
import { MERCHANT_CAPABILITY_PERMISSION, MerchantCapabilitySchema, parsePermissionSlug, type PermissionPair } from "./permission";

/**
 * The session's CASL ability — what every app's `<Can>` and `useAbility()` (@casl/react) read to show or
 * hide UI. It speaks the permission catalogue's own vocabulary (ADR 067): the action is a catalogue verb,
 * the subject a catalogue noun:
 *
 *   <Can I="UPDATE" a="REWARD">…</Can>      ability.can("DELETE", "PRODUCT")
 *
 * It is a PROJECTION of what the API already decided, never a second policy engine: the rules come from
 * the session's capability slugs (`GET /auth/permissions`, or the merchant membership's capabilities) and
 * carry no conditions — ownership, shares and store scope are never re-implemented in the browser. The API
 * and PostgreSQL row-level security check every request again.
 */
export type AppAbility = Ability<[PermissionAction, PermissionResource]>;

/** Which slugs an app's ability is built from: `platform:*` (admin, web, mobile) or `merchant:*` (merchant app). */
export type CapabilityNamespace = "platform" | "merchant";

const NAMESPACE_PREFIX: Readonly<Record<CapabilityNamespace, string>> = { platform: "platform:", merchant: "merchant:" };

/** The catalogue permission behind a capability slug, or null for an unknown slug (it then grants nothing). */
export function permissionOfCapability(slug: CapabilitySlug): PermissionPair | null {
	const merchant = MerchantCapabilitySchema.safeParse(slug);
	return merchant.success ? MERCHANT_CAPABILITY_PERMISSION[merchant.data] : parsePermissionSlug(slug);
}

/** The ability's rules: one unconditional `can` per known slug of the namespace. */
export function abilityRules(capabilities: readonly CapabilitySlug[], namespace: CapabilityNamespace): RawRuleOf<AppAbility>[] {
	return capabilities
		.filter((slug: CapabilitySlug): boolean => slug.startsWith(NAMESPACE_PREFIX[namespace]))
		.flatMap((slug: CapabilitySlug): RawRuleOf<AppAbility>[] => {
			const permission = permissionOfCapability(slug);
			return permission === null ? [] : [{ action: permission.action, subject: permission.resource }];
		});
}

/** Whether the ability allows the permission behind a capability slug (an unknown slug: never). */
export function abilityAllowsCapability(ability: AppAbility, slug: CapabilitySlug): boolean {
	const permission = permissionOfCapability(slug);
	return permission !== null && ability.can(permission.action, permission.resource);
}

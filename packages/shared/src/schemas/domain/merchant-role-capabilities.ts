import { z } from "zod";

import { CapabilitySlugSchema, type CapabilitySlug } from "./capabilities";
import { MerchantMemberRoleSchema, type MerchantMemberRole } from "./rewards";

/** Capabilities granted to a merchant member role (`merchant_role_capabilities`). */
export const MerchantRoleCapabilityGrantSchema = z
	.object({
		role: MerchantMemberRoleSchema,
		capabilities: z.array(CapabilitySlugSchema),
	})
	.strict();

export type MerchantRoleCapabilityGrant = z.output<typeof MerchantRoleCapabilityGrantSchema>;

export const SyncMerchantRoleCapabilitiesBodySchema = z
	.object({
		capabilities: z.array(CapabilitySlugSchema),
	})
	.strict();

export type SyncMerchantRoleCapabilitiesBody = z.output<typeof SyncMerchantRoleCapabilitiesBodySchema>;

export const SyncMerchantRoleCapabilitiesInputSchema = SyncMerchantRoleCapabilitiesBodySchema.extend({
	role: MerchantMemberRoleSchema,
}).strict();

export type SyncMerchantRoleCapabilitiesInput = z.output<typeof SyncMerchantRoleCapabilitiesInputSchema>;

export const MerchantRoleCapabilitiesPathInputSchema = z
	.object({
		role: MerchantMemberRoleSchema,
	})
	.strict();

export type MerchantRoleCapabilitiesPathInput = z.output<typeof MerchantRoleCapabilitiesPathInputSchema>;

/** Lookup a role grant from the API list payload. */
export function findMerchantRoleGrant(grants: readonly MerchantRoleCapabilityGrant[], role: MerchantMemberRole): MerchantRoleCapabilityGrant | undefined {
	return grants.find((grant) => grant.role === role);
}

/** Returns capability slugs for a role (empty when the role is missing from the list). */
export function resolveMerchantRoleCapabilities(grants: readonly MerchantRoleCapabilityGrant[], role: MerchantMemberRole): readonly CapabilitySlug[] {
	const grant = findMerchantRoleGrant(grants, role);
	if (grant === undefined) {
		return [];
	}
	return grant.capabilities;
}

/** Toggle one capability slug on/off while preserving catalog order. */
export function withMerchantCapabilityToggled(
	catalogOrder: readonly CapabilitySlug[],
	capabilities: readonly CapabilitySlug[],
	capability: CapabilitySlug,
	enabled: boolean,
): CapabilitySlug[] {
	const selected = new Set<CapabilitySlug>(capabilities);
	if (enabled) {
		selected.add(capability);
	} else {
		selected.delete(capability);
	}
	const next: CapabilitySlug[] = [];
	for (const slug of catalogOrder) {
		if (selected.has(slug)) {
			next.push(slug);
		}
	}
	return next;
}

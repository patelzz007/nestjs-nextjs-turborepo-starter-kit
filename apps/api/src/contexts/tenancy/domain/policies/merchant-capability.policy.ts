import { MERCHANT_CAPABILITY_CEDAR_ACTIONS, MerchantCapabilitySchema, merchantRoleHasCapability, type CapabilitySlug, type MembershipRole } from "@workspace/shared";

/** The capability → tenant Cedar action table lives in `@workspace/shared` (authorization reads it too). */
export { MERCHANT_CAPABILITY_CEDAR_ACTIONS };

/** The tenant Cedar action guarding `capability`, or `null` for a slug no API action is guarded by (callers fail closed). */
export function cedarActionForCapability(capability: CapabilitySlug): string | null {
	const parsed = MerchantCapabilitySchema.safeParse(capability);
	return parsed.success ? MERCHANT_CAPABILITY_CEDAR_ACTIONS[parsed.data] : null;
}

/** The baseline role table shared with the merchant app; tenant Cedar policies may only narrow it. */
export function roleGrantsCapability(role: MembershipRole, capability: CapabilitySlug): boolean {
	return merchantRoleHasCapability(role, capability);
}

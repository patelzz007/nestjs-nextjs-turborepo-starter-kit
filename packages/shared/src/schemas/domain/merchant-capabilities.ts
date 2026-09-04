import { z } from "zod";

/** Known merchant portal capability slugs — validated at API boundaries; grants live in `merchant_role_capabilities`. */
export const MerchantCapabilitySchema = z.enum([
	"merchant:view_dashboard",
	"merchant:view_analytics",
	"merchant:view_rewards",
	"merchant:manage_rewards",
	"merchant:view_redemptions",
	"merchant:manage_api_keys",
]);

export type MerchantCapability = z.output<typeof MerchantCapabilitySchema>;

/** Parses and filters unknown capability strings (e.g. from the database). */
export function parseMerchantCapabilities(values: readonly string[]): MerchantCapability[] {
	const parsed: MerchantCapability[] = [];
	for (const value of values) {
		const result = MerchantCapabilitySchema.safeParse(value);
		if (result.success) {
			parsed.push(result.data);
		}
	}
	return parsed;
}

/** Returns whether a capability set includes the requested capability. */
export function merchantHasCapability(capabilities: readonly MerchantCapability[], capability: MerchantCapability): boolean {
	return capabilities.includes(capability);
}

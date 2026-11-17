import type { CustomerPickerOption } from "@/components/merchant-ui/customer-picker";
import { CUSTOMER_TIER_LABELS, type RewardAudienceType, type RewardCustomer } from "@workspace/shared";
import { format } from "date-fns";

/**
 * One of the tenant's customers as the picker shows them: their name, masked email, claim history and — while tiers
 * are on — their tier (ADR 085: the tier only, never what is behind it).
 */
export function toRewardCustomerOption(customer: RewardCustomer): CustomerPickerOption {
	const claims = customer.claimCount === 1 ? "Claimed once" : `Claimed ${String(customer.claimCount)} times`;
	const tier = customer.tier === null ? "" : `${CUSTOMER_TIER_LABELS[customer.tier]} · `;
	return {
		userId: customer.userId,
		fullName: customer.fullName,
		maskedEmail: customer.maskedEmail,
		detail: `${tier}${claims} · last ${format(customer.lastClaimedAt, "d MMM yyyy")}`,
		unavailableReason: null,
	};
}

/** Who can claim a reward, in the merchant's words ("Everyone" / "3 chosen customers"). */
export function describeRewardAudience(audienceType: RewardAudienceType, customerCount: number): string {
	if (audienceType === "EVERYONE") {
		return "Everyone";
	}
	return customerCount === 1 ? "1 chosen customer" : `${String(customerCount)} chosen customers`;
}

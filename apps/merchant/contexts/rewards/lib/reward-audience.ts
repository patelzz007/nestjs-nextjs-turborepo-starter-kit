import type { CustomerPickerOption } from "@/components/merchant-ui/customer-picker";
import type { RewardAudienceType, RewardCustomer } from "@workspace/shared";
import { format } from "date-fns";

/** One of the tenant's customers as the picker shows them: their name, masked email and claim history. */
export function toRewardCustomerOption(customer: RewardCustomer): CustomerPickerOption {
	const claims = customer.claimCount === 1 ? "Claimed once" : `Claimed ${String(customer.claimCount)} times`;
	return {
		userId: customer.userId,
		fullName: customer.fullName,
		maskedEmail: customer.maskedEmail,
		detail: `${claims} · last ${format(customer.lastClaimedAt, "d MMM yyyy")}`,
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

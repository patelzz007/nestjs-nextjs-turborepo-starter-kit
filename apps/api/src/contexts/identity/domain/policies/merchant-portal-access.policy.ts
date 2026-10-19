import { MerchantAccessRequiredError } from "../errors/identity.errors";

/** What decides whether an account may sign in to the merchant portal. */
export interface MerchantPortalAccessFacts {
	readonly hasMerchantMembership: boolean;
	/** The account holds `MANAGE MERCHANT_ORG` (platform staff). */
	readonly canManageMerchants: boolean;
	/** An unexpired, pending team invitation exists for the account's address (it signs in to accept it). */
	readonly hasPendingTeamInvite: boolean;
}

/** Merchant portal sign-in needs a merchant membership, the merchant-management grant, or a pending team invite. */
export function assertMerchantPortalAccess(facts: MerchantPortalAccessFacts): void {
	if (!facts.hasMerchantMembership && !facts.canManageMerchants && !facts.hasPendingTeamInvite) {
		throw new MerchantAccessRequiredError();
	}
}

import type { MerchantVerification } from "../aggregates/merchant-verification.aggregate";

/** Persistence port of the {@link MerchantVerification} aggregate (bound to one unit of work). */
export interface MerchantVerificationRepository {
	/** The review of a merchant tenant, read under the merchant profile's row lock; `null` when there is no merchant profile. */
	getForUpdate(tenantId: string): Promise<MerchantVerification | null>;
	/** File ids of the active submission's evidence, oldest link first. */
	activeEvidenceFileIds(tenantId: string): Promise<readonly string[]>;
	/** Compare-and-set on the loaded review status; replaces the evidence links when the aggregate did. */
	save(verification: MerchantVerification): Promise<void>;
}

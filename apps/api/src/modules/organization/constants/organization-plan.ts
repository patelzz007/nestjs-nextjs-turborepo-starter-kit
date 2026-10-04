/** Features an organization entitlement switches on. */
export interface OrganizationPlanFeatures {
	readonly rewards: boolean;
	readonly apiKeys: boolean;
}

/** The entitlement every newly provisioned organization starts on. */
export interface OrganizationPlanEntitlement {
	readonly planCode: string;
	readonly version: number;
	readonly features: OrganizationPlanFeatures;
}

/**
 * The one plan the product offers today: every organization is provisioned on
 * the pilot plan with rewards and API keys enabled. Neither provisioning
 * contract carries a plan choice — selling more than one plan is a product
 * decision that adds a validated `planCode` to those contracts and retires this
 * default.
 */
export const ORGANIZATION_DEFAULT_PLAN: OrganizationPlanEntitlement = {
	planCode: "pilot",
	version: 1,
	features: { rewards: true, apiKeys: true },
};

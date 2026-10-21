import { Global, Module } from "@nestjs/common";

import { REFERABLE_REWARD_LOOKUP_FACTORY, SIGNUP_REFERRAL_AUDIT_FACTORY } from "../../referrals/public-api";
import { REWARDS_REFERABLE_REWARD_LOOKUP_FACTORY } from "./adapters/referable-reward-lookup.adapter";
import { REWARD_AUDIT_SIGNUP_REFERRAL_AUDIT_FACTORY } from "./adapters/signup-referral-audit.adapter";

/**
 * What rewards provides to code that must not import it (a leaf: platform and referrals' token only):
 * referrals' code-job audit writer (`SIGNUP_REFERRAL_AUDIT_FACTORY`) and its share-link reward check
 * (`REFERABLE_REWARD_LOOKUP_FACTORY`). Global, like `PosAccessModule`, so
 * referrals never imports rewards and the graph stays acyclic (identity depends on referrals, and
 * rewards depends on tenants, which depends on identity).
 */
@Global()
@Module({
	providers: [
		{ provide: SIGNUP_REFERRAL_AUDIT_FACTORY, useValue: REWARD_AUDIT_SIGNUP_REFERRAL_AUDIT_FACTORY },
		{ provide: REFERABLE_REWARD_LOOKUP_FACTORY, useValue: REWARDS_REFERABLE_REWARD_LOOKUP_FACTORY },
	],
	exports: [SIGNUP_REFERRAL_AUDIT_FACTORY, REFERABLE_REWARD_LOOKUP_FACTORY],
})
export class RewardsAccessModule {}

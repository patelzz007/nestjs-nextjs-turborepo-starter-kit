import { Global, Module } from "@nestjs/common";

import { SIGNUP_REFERRAL_AUDIT_FACTORY } from "../../referrals/public-api";
import { REWARD_AUDIT_SIGNUP_REFERRAL_AUDIT_FACTORY } from "./adapters/signup-referral-audit.adapter";

/**
 * What rewards provides to code that must not import it (a leaf: platform and referrals' token only):
 * referrals' code-job audit writer (`SIGNUP_REFERRAL_AUDIT_FACTORY`). Global, like `PosAccessModule`, so
 * referrals never imports rewards and the graph stays acyclic (identity depends on referrals, and
 * rewards depends on tenants, which depends on identity).
 */
@Global()
@Module({
	providers: [{ provide: SIGNUP_REFERRAL_AUDIT_FACTORY, useValue: REWARD_AUDIT_SIGNUP_REFERRAL_AUDIT_FACTORY }],
	exports: [SIGNUP_REFERRAL_AUDIT_FACTORY],
})
export class RewardsAccessModule {}

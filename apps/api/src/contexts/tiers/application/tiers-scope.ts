import type { TierNoticesPort } from "./ports/tier-notices.port";
import type { CountedRedemptionsPort, TierRulesPort, TierStandingRepository } from "./ports/tier-standing.repository";

/** Everything one tier evaluation's transaction can touch. Every member is bound to that transaction (plan §5.4). */
export interface TiersScope {
	readonly standings: TierStandingRepository;
	readonly redemptions: CountedRedemptionsPort;
	readonly rules: TierRulesPort;
	readonly notices: TierNoticesPort;
}

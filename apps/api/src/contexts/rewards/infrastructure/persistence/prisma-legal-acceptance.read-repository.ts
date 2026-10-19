import type { RewardClaimCheckoutStatus } from "@workspace/shared";

import type { ActorContext } from "../../../../platform/application/actor-context";
import type { LegalAcceptanceReadPort } from "../../application/ports/reward-read.port";
import type { RewardsReadSession } from "./rewards-read-session";

/** The customer's latest live legal acceptance and their verified phone (read from the account until identity publishes a profile port). */
export class PrismaLegalAcceptanceReadRepository implements LegalAcceptanceReadPort {
	public constructor(private readonly session: RewardsReadSession) {}

	public async checkoutStatus(actor: ActorContext, userId: string): Promise<RewardClaimCheckoutStatus> {
		const [acceptance, user] = await this.session.readOwn(actor, async (db) =>
			Promise.all([
				db.rewardLegalAcceptance.findFirst({ where: { userId, isDeleted: false }, select: { termsVersion: true, privacyVersion: true } }),
				db.user.findUnique({ where: { id: userId }, select: { phone: true, phoneVerifiedAt: true } }),
			]),
		);
		return {
			hasAcceptedLegal: acceptance !== null,
			termsVersion: acceptance?.termsVersion ?? null,
			privacyVersion: acceptance?.privacyVersion ?? null,
			phone: user?.phone ?? null,
			phoneVerified: user !== null && user.phoneVerifiedAt !== null,
		};
	}
}

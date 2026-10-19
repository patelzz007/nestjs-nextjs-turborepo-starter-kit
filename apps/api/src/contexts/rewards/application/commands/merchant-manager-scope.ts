import type { ActorContext } from "../../../../platform/application/actor-context";
import { AuthenticationError } from "../../../../platform/application/errors/app-error";
import type { MerchantAccessGrant } from "../../../../platform/application/ports/authorization.port";
import type { RewardManager } from "../../domain/aggregates/reward.aggregate";

/**
 * The stores a merchant caller may manage, as the domain takes it: `null` for a caller who
 * covers every store, otherwise exactly its stores (an empty list manages nothing).
 */
export function managerLocationIds(grant: MerchantAccessGrant): readonly string[] | null {
	return grant.locationScope === "ALL_LOCATIONS" ? null : grant.locationIds;
}

/** The merchant caller of an edit: its stores, and the member or API key recorded on audit columns. */
export function rewardManager(actor: ActorContext, grant: MerchantAccessGrant): RewardManager {
	if (actor.kind === "user") {
		return { locationIds: managerLocationIds(grant), actorId: actor.userId };
	}
	if (actor.kind === "api_key") {
		return { locationIds: managerLocationIds(grant), actorId: actor.apiKeyId };
	}
	throw new AuthenticationError({ message: "Merchant authentication required" });
}

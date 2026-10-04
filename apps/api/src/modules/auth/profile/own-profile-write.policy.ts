import { Injectable } from "@nestjs/common";
import { assertNever } from "@workspace/shared";

import type { ProfileActor } from "./profile-actor";

/** Why a profile write is refused. */
export type OwnProfileWriteDenialReason = "impersonated_session";

export type OwnProfileWriteDecision = { readonly allowed: true } | { readonly allowed: false; readonly reason: OwnProfileWriteDenialReason };

/**
 * May this actor change the profile?
 *
 * Only the user themselves. An impersonation session exists to SEE the
 * platform as the user does (support, debugging); the profile is the user's
 * self-representation — the name their team, merchants and emails show — so
 * changing it on their behalf would put words in their mouth that they never
 * chose. Reading stays allowed (the impersonator must see what the user sees),
 * and the refused attempt is still audited with the impersonator's id by the
 * global exception filter. A legitimate correction by staff belongs on an
 * explicit, permission-gated admin endpoint, never on the self-service one.
 */
@Injectable()
export class OwnProfileWritePolicy {
	public canWrite(actor: ProfileActor): OwnProfileWriteDecision {
		switch (actor.kind) {
			case "self":
				return { allowed: true };
			case "impersonated":
				return { allowed: false, reason: "impersonated_session" };
			default:
				return assertNever(actor, "profile actor");
		}
	}
}

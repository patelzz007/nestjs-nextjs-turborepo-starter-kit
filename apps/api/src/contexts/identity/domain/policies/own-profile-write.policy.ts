import { ProfileUpdateDuringImpersonationError } from "../errors/identity.errors";

/**
 * Who is acting on the profile, as the server verified it (the access token the guard already
 * validated, including the live impersonation session):
 * - `self` — the user, signed in as themselves;
 * - `impersonated` — a SuperAdmin acting as `userId` through an impersonation session.
 * The profile is ALWAYS `userId`'s own; the actor kind only decides what may be done to it.
 */
export type ProfileActor = { readonly kind: "self"; readonly userId: string } | { readonly kind: "impersonated"; readonly userId: string };

/** The verified claims the actor is derived from. */
export interface ProfileActorClaims {
	readonly sub: string;
	readonly isImpersonating?: boolean | undefined;
}

/** Maps verified access-token claims onto the profile actor. */
export function toProfileActor(claims: ProfileActorClaims): ProfileActor {
	return claims.isImpersonating === true ? { kind: "impersonated", userId: claims.sub } : { kind: "self", userId: claims.sub };
}

/** Why a profile write is refused. */
export type OwnProfileWriteDenialReason = "impersonated_session";

export type OwnProfileWriteDecision = { readonly allowed: true } | { readonly allowed: false; readonly reason: OwnProfileWriteDenialReason };

/**
 * May this actor change the profile?
 *
 * Only the user themselves. An impersonation session exists to SEE the platform as the user does
 * (support, debugging); the profile is the user's self-representation — the name their team,
 * merchants and emails show — so changing it on their behalf would put words in their mouth that
 * they never chose. Reading stays allowed (the impersonator must see what the user sees), and the
 * refused attempt is still audited with the impersonator's id by the global exception filter.
 */
export function decideOwnProfileWrite(actor: ProfileActor): OwnProfileWriteDecision {
	return actor.kind === "self" ? { allowed: true } : { allowed: false, reason: "impersonated_session" };
}

/** The authorization step of a profile edit: throws {@link ProfileUpdateDuringImpersonationError} unless the actor is the user themselves. */
export function assertOwnProfileWritable(actor: ProfileActor): void {
	if (!decideOwnProfileWrite(actor).allowed) {
		throw new ProfileUpdateDuringImpersonationError();
	}
}

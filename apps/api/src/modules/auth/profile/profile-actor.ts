import type { AccessTokenPayload } from "../services/token.service";

/**
 * Who is acting on the profile, as the server verified it (the access token
 * `AuthGuard` already validated — including the live impersonation session):
 * - `self` — the user, signed in as themselves;
 * - `impersonated` — a SuperAdmin acting as `userId` through an impersonation session.
 * The profile is ALWAYS `userId`'s own; the actor kind only decides what may be done to it.
 */
export type ProfileActor = { readonly kind: "self"; readonly userId: string } | { readonly kind: "impersonated"; readonly userId: string };

/** The token claims the actor is derived from. */
export type ProfileActorClaims = Pick<AccessTokenPayload, "sub" | "isImpersonating">;

/** Maps verified access-token claims onto the profile actor. */
export function toProfileActor(claims: ProfileActorClaims): ProfileActor {
	return claims.isImpersonating === true ? { kind: "impersonated", userId: claims.sub } : { kind: "self", userId: claims.sub };
}

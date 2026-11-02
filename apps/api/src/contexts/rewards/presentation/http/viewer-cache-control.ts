import type { ActorContext } from "../../../../platform/application/actor-context";

/** What a shared cache may keep of the public marketplace: the same answer for everyone signed out. */
export const MARKETPLACE_PUBLIC_CACHE_CONTROL = "public, max-age=60";
/** A signed-in viewer's answer can include rewards given only to them: never stored by a shared cache. */
export const MARKETPLACE_VIEWER_CACHE_CONTROL = "private, no-store, max-age=0";

/**
 * The marketplace answer depends on who asks once rewards can be given to chosen customers: a signed-out
 * visitor gets the cacheable public answer; anyone else gets one no shared cache may store.
 */
export function marketplaceCacheControl(actor: ActorContext): string {
	return actor.kind === "anonymous" ? MARKETPLACE_PUBLIC_CACHE_CONTROL : MARKETPLACE_VIEWER_CACHE_CONTROL;
}

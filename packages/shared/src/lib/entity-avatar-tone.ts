// The tint an entity's monogram gets (a shop, a tenant, a team without a logo), shared by the web and native kits:
// one of the four saturated chart tokens, picked from the name so the same name always gets the same colour.

import { LIST_SLOT_INDEX } from "./named-list-index";

/** The chart tokens a monogram is tinted with (`chart-5` is each theme's near-grey slot, so it is left out). */
export type EntityAvatarTone = "chart-1" | "chart-2" | "chart-3" | "chart-4";

export const ENTITY_AVATAR_TONES: readonly [EntityAvatarTone, EntityAvatarTone, EntityAvatarTone, EntityAvatarTone] = ["chart-1", "chart-2", "chart-3", "chart-4"];

/** Classic 31-multiplier string hash (as in Java's `String#hashCode`) — stable across runs and platforms. */
const NAME_HASH_MULTIPLIER = 31;

function hashName(name: string): number {
	let hash = 0;
	for (const character of name.trim().toLocaleLowerCase()) {
		// `>>> 0` keeps the running hash an unsigned 32-bit integer.
		hash = (hash * NAME_HASH_MULTIPLIER + (character.codePointAt(0) ?? 0)) >>> 0;
	}
	return hash;
}

/** The monogram tint for a name — deterministic, case- and surrounding-whitespace-insensitive. */
export function getEntityAvatarTone(name: string): EntityAvatarTone {
	// The modulo keeps the index in range, so the fallback is never reached.
	return ENTITY_AVATAR_TONES[hashName(name) % ENTITY_AVATAR_TONES.length] ?? ENTITY_AVATAR_TONES[LIST_SLOT_INDEX.first];
}

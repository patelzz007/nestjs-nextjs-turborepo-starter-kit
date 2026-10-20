import type { OwnProfile } from "@workspace/shared";

import type { UserProfile } from "../aggregates/user-profile.aggregate";

/** Own profiles, bound to one unit-of-work transaction. */
export interface UserProfileRepository {
	/** The live (not soft-deleted) account's profile, or `null`. */
	findLive(userId: string): Promise<UserProfile | null>;

	/** The full own-profile payload (avatar included) as stored now, in this transaction. */
	readOwnProfile(userId: string): Promise<OwnProfile | null>;

	/** Writes an edit: compare-and-set on the version the client read. Zero rows throws `ConcurrentModificationError` (409). */
	save(profile: UserProfile): Promise<void>;
}

/** Identity's avatar rows (`UserAvatar`), bound to one transaction. */
export interface UserAvatarBindings {
	/** Makes a READY file the uploader's live avatar (replacing any previous one, reviving a released row). */
	bindReadyAvatar(userId: string, fileId: string, boundAt: number): Promise<void>;

	/** Soft-deletes every live avatar row of a deleted file. */
	releaseFile(fileId: string, deletedBy: string, deletedAt: number): Promise<void>;
}

/** What identity's file reactions can touch inside the files transaction. */
export interface UserAvatarFileScope {
	readonly avatars: UserAvatarBindings;
}

/** Whose broadcast a picture is for: a store's (its own images) or the platform's (staff uploads). */
export type BroadcastImageOwner = { readonly kind: "tenant"; readonly tenantId: string } | { readonly kind: "platform" };

/** The pictures a broadcast body names (enhancement 5.4), on the unit of work's transaction. */
export interface BroadcastImageFilesPort {
	/**
	 * Locks the files (`FOR UPDATE`, as file deletion does) and checks each is a ready picture of this owner's
	 * broadcast category; refuses (400) otherwise. A save and a delete of
	 * the same picture never interleave.
	 */
	lockUsable(owner: BroadcastImageOwner, fileIds: readonly string[]): Promise<void>;
	/** The public address of each ready picture (its largest rendition, or the file's own public copy); missing ones are left out. */
	sources(fileIds: readonly string[]): Promise<ReadonlyMap<string, string>>;
}

/** Which broadcasts still show a picture (enhancement 5.4), on the files deletion transaction. */
export interface BroadcastImageUses {
	/** Broadcasts not removed whose body names this file. */
	countLiveUses(fileId: string): Promise<number>;
}

/** The scope the in-use guard reads through. */
export interface BroadcastImageUseScope {
	readonly broadcastImageUses: BroadcastImageUses;
}

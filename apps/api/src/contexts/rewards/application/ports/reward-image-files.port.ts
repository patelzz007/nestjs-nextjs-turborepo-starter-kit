/** Rewards' image rows (`RewardImage`) as a file deletion sees them, bound to one transaction. */
export interface RewardImageFileUses {
	/** How many live rewards show the file. */
	countLiveUses(fileId: string): Promise<number>;
}

/** What rewards' file reference guard can read inside the files transaction. */
export interface RewardImageFileScope {
	readonly rewardImages: RewardImageFileUses;
}

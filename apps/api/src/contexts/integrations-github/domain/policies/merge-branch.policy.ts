// What happens to a pull request's branch after a merge (ADR 052).

/** The branch is deleted only when asked, and only when it belongs to this repository (a fork's branch is never ours to delete). */
export function shouldDeleteMergedBranch(deleteRequested: boolean, isCrossRepository: boolean): boolean {
	return deleteRequested && !isCrossRepository;
}

/** Folders inside `docs/` that are not guides: posts are published under `/blog`, dated notes never are. */
const NOT_GUIDE_FOLDERS: readonly string[] = ["blog/", "history/"];

/** Whether a file path relative to `docs/` is a guide page. The security audit in `history/` must never be one. */
export function isPublishedGuide(file: string): boolean {
	return !NOT_GUIDE_FOLDERS.some((folder) => file.startsWith(folder));
}

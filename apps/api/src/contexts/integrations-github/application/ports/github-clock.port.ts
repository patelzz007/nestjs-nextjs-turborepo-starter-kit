/** The source of "now" for GitHub caches, reviews and retention — a port, so tests pin it. */
export interface GithubClock {
	nowEpochMs(): number;
}

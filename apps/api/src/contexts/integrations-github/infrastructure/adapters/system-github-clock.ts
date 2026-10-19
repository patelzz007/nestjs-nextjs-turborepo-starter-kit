import type { GithubClock } from "../../application/ports/github-clock.port";

/** Production binding of `GITHUB_CLOCK`: the wall clock. */
export const SYSTEM_GITHUB_CLOCK: GithubClock = { nowEpochMs: (): number => Date.now() };

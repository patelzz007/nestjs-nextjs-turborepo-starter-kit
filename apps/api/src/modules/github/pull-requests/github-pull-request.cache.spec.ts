import type { GithubPullRequestPage, GithubTimelinePage } from "@workspace/shared";
import { describe, expect, it, vi } from "vitest";

import { cacheKey, GithubPullRequestCache, pullRequestKey } from "./github-pull-request.cache";

const DETAIL = "detail";
const EMPTY_TIMELINE: GithubTimelinePage = { items: [], nextCursor: null };
const EMPTY_LIST: GithubPullRequestPage = { items: [], nextCursor: null, totalCount: 0 };

function cache(): GithubPullRequestCache {
	return new GithubPullRequestCache({ nowEpochMs: (): number => 0 });
}

/** Whether `read` reached `load` — i.e. nothing was cached for the key. */
async function loads<V>(read: (load: () => Promise<V>) => Promise<V>, value: V): Promise<boolean> {
	const load = vi.fn((): Promise<V> => Promise.resolve(value));
	await read(load);
	return load.mock.calls.length > 0;
}

describe("pull-request cache keys", () => {
	it("names one pull request case-insensitively, like GitHub", () => {
		expect(pullRequestKey("Octo-Org", "Hello-World", 42)).toBe(pullRequestKey("octo-org", "hello-world", 42));
	});

	it("puts the user first", () => {
		expect(cacheKey("user-1", "a", "b")).toBe("user-1|a|b");
	});
});

describe("GithubPullRequestCache", () => {
	it("drops one pull request for every user, and every list — and nothing else", async () => {
		const subject = cache();
		const pr42 = pullRequestKey("octo-org", "hello-world", 42);
		const pr7 = pullRequestKey("octo-org", "hello-world", 7);
		const page = EMPTY_LIST;
		await subject.lists.read(subject.listKey("user-1", "yours", "open"), () => Promise.resolve(page));
		await subject.timelines.read(cacheKey("user-1", pr42, "timeline"), () => Promise.resolve(EMPTY_TIMELINE));
		await subject.timelines.read(cacheKey("user-2", pr42, "timeline"), () => Promise.resolve(EMPTY_TIMELINE));
		await subject.timelines.read(cacheKey("user-1", pr7, "timeline"), () => Promise.resolve(EMPTY_TIMELINE));

		subject.invalidatePullRequest("Octo-Org", "hello-world", 42);

		expect(await loads((load) => subject.timelines.read(cacheKey("user-1", pr42, "timeline"), load), EMPTY_TIMELINE)).toBe(true);
		expect(await loads((load) => subject.timelines.read(cacheKey("user-2", pr42, "timeline"), load), EMPTY_TIMELINE)).toBe(true);
		expect(await loads((load) => subject.lists.read(subject.listKey("user-1", "yours", "open"), load), page)).toBe(true);
		expect(await loads((load) => subject.timelines.read(cacheKey("user-1", pr7, "timeline"), load), EMPTY_TIMELINE)).toBe(false);
	});

	it("drops everything of one user, and only theirs", async () => {
		const subject = cache();
		const pr = pullRequestKey("octo-org", "hello-world", 42);
		const page = EMPTY_TIMELINE;
		await subject.timelines.read(cacheKey("user-1", pr, DETAIL), () => Promise.resolve(page));
		await subject.timelines.read(cacheKey("user-10", pr, DETAIL), () => Promise.resolve(page));

		subject.invalidateUser("user-1");

		expect(await loads((load) => subject.timelines.read(cacheKey("user-1", pr, DETAIL), load), page)).toBe(true);
		// "user-10" starts with "user-1" — the separator keeps them apart.
		expect(await loads((load) => subject.timelines.read(cacheKey("user-10", pr, DETAIL), load), page)).toBe(false);
	});
});

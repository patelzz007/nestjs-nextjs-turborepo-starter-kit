import { Logger } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";

import { NotFoundError } from "../../common/errors/app-error";
import { GithubResponseError, GithubUnavailableError, repositoryTarget } from "./github.errors";
import { GithubResponseCache } from "./github-response.cache";

const FRESH_MS = 1_000;
const STALE_FALLBACK_MS = 10_000;
const START = 1_800_000_000_000;
const REPOSITORY = { owner: "octo-org", repository: "hello-world" };

/** Keeps what the cache warns about instead of printing it. */
class RecordingLogger extends Logger {
	public readonly warnings: string[] = [];

	public override warn(message: string): void {
		this.warnings.push(message);
	}
}

interface TestClock {
	now: number;
	nowEpochMs(): number;
}

interface Harness {
	readonly cache: GithubResponseCache<string>;
	readonly clock: TestClock;
	readonly logger: RecordingLogger;
}

function setup(): Harness {
	const clock: TestClock = { now: START, nowEpochMs: (): number => clock.now };
	const logger = new RecordingLogger("test");
	return { cache: new GithubResponseCache<string>({ freshMs: FRESH_MS, staleFallbackMs: STALE_FALLBACK_MS, maxEntries: 10 }, clock, logger), clock, logger };
}

function cacheable(value: string): () => Promise<string> {
	return (): Promise<string> => Promise.resolve(value);
}

function failing(error: Error): () => Promise<string> {
	return (): Promise<string> => Promise.reject(error);
}

describe("GithubResponseCache", () => {
	it("serves a fresh answer without loading again", async () => {
		const { cache, clock } = setup();
		const load = vi.fn(cacheable("first"));

		await cache.read("key", load);
		clock.now += FRESH_MS - 1;

		expect(await cache.read("key", cacheable("second"))).toBe("first");
		expect(load).toHaveBeenCalledTimes(1);
	});

	it("loads again once the answer is no longer fresh", async () => {
		const { cache, clock } = setup();

		await cache.read("key", cacheable("first"));
		clock.now += FRESH_MS;

		expect(await cache.read("key", cacheable("second"))).toBe("second");
	});

	it("keeps keys apart", async () => {
		const { cache } = setup();

		await cache.read("a", cacheable("for a"));

		expect(await cache.read("b", cacheable("for b"))).toBe("for b");
	});

	it("shares one load between concurrent misses of the same key", async () => {
		const { cache } = setup();
		let resolveLoad: (value: string) => void = (): void => undefined;
		const load = vi.fn(
			(): Promise<string> =>
				new Promise<string>((resolve): void => {
					resolveLoad = resolve;
				}),
		);

		const first = cache.read("key", load);
		const second = cache.read("key", load);
		resolveLoad("shared");

		expect(await Promise.all([first, second])).toEqual(["shared", "shared"]);
		expect(load).toHaveBeenCalledTimes(1);
	});

	it("loads again after a failed single-flight load instead of replaying the failure", async () => {
		const { cache } = setup();

		await expect(cache.read("key", failing(new GithubUnavailableError("timeout")))).rejects.toBeInstanceOf(GithubUnavailableError);

		expect(await cache.read("key", cacheable("recovered"))).toBe("recovered");
	});

	it.each([
		["unavailable", new GithubUnavailableError("rate-limited")],
		["answering badly", new GithubResponseError("unexpected-status", repositoryTarget(REPOSITORY), "HTTP 500")],
	])("serves the stale answer, and logs it, while GitHub is %s", async (_label: string, error: Error) => {
		const { cache, clock, logger } = setup();

		await cache.read("key", cacheable("stale"));
		clock.now += FRESH_MS + STALE_FALLBACK_MS - 1;

		expect(await cache.read("key", failing(error))).toBe("stale");
		expect(logger.warnings).toHaveLength(1);
	});

	it("does not stand in for a failure that is about the repository itself", async () => {
		const { cache, clock } = setup();
		const notFound = new NotFoundError();

		await cache.read("key", cacheable("stale"));
		clock.now += FRESH_MS;

		await expect(cache.read("key", failing(notFound))).rejects.toBe(notFound);
	});

	it("fails once the stale fallback window has passed", async () => {
		const { cache, clock } = setup();
		const unavailable = new GithubUnavailableError("unreachable");

		await cache.read("key", cacheable("too old"));
		clock.now += FRESH_MS + STALE_FALLBACK_MS + 1;

		await expect(cache.read("key", failing(unavailable))).rejects.toBe(unavailable);
	});

	describe("invalidate", () => {
		it("drops only the answers it matches, so the next read of those asks GitHub again", async () => {
			const { cache } = setup();
			await cache.read("pr-7:detail", cacheable("old detail"));
			await cache.read("pr-9:detail", cacheable("other"));

			cache.invalidate((key: string): boolean => key.startsWith("pr-7:"));

			expect(await cache.read("pr-7:detail", cacheable("new detail"))).toBe("new detail");
			const untouched = vi.fn(cacheable("reloaded"));
			expect(await cache.read("pr-9:detail", untouched)).toBe("other");
			expect(untouched).not.toHaveBeenCalled();
		});

		it("answers a read that was on its way to GitHub, but does not keep what may predate the change", async () => {
			const { cache } = setup();
			let finishOldRead: (value: string) => void = (): void => undefined;
			const oldRead = cache.read(
				"pr-7:detail",
				(): Promise<string> =>
					new Promise<string>((resolve): void => {
						finishOldRead = resolve;
					}),
			);

			cache.invalidate((key: string): boolean => key.startsWith("pr-7:"));
			const newRead = cache.read("pr-7:detail", cacheable("after the change"));
			finishOldRead("before the change");

			expect(await oldRead).toBe("before the change");
			expect(await newRead).toBe("after the change");
			// The newer answer is the one kept.
			const reload = vi.fn(cacheable("unused"));
			expect(await cache.read("pr-7:detail", reload)).toBe("after the change");
			expect(reload).not.toHaveBeenCalled();
		});
	});
});

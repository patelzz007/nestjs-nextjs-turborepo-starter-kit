import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import { breachedIn, breachedPasswordCheckFor, HIBP_RANGE_URL, HibpBreachedPasswordCheck, SkippedBreachedPasswordCheck, type RangeFetch } from "../breached-password.adapters";

const PASSWORD = "P@ssw0rd";
const DIGEST = createHash("sha1").update(PASSWORD).digest("hex").toUpperCase();
const PREFIX = DIGEST.slice(0, 5);
const SUFFIX = DIGEST.slice(5);

interface Call {
	readonly url: string;
	readonly headers: Readonly<Record<string, string>>;
}

/** A range API answering `body` (or failing) and recording each call. */
function fakeRange(answer: { readonly status: number; readonly body: string } | Error): { readonly fetchRange: RangeFetch; readonly calls: Call[] } {
	const calls: Call[] = [];
	const fetchRange: RangeFetch = (url, init) => {
		calls.push({ url, headers: init.headers });
		if (answer instanceof Error) {
			return Promise.reject(answer);
		}
		return Promise.resolve({ ok: answer.status === 200, status: answer.status, text: (): Promise<string> => Promise.resolve(answer.body) });
	};
	return { fetchRange, calls };
}

describe("HibpBreachedPasswordCheck", () => {
	it("sends only the first 5 characters of the SHA-1, asking for a padded answer", async () => {
		const range = fakeRange({ status: 200, body: "" });
		await new HibpBreachedPasswordCheck(range.fetchRange).check(PASSWORD);
		expect(range.calls).toEqual([{ url: `${HIBP_RANGE_URL}${PREFIX}`, headers: { "Add-Padding": "true" } }]);
		expect(range.calls.map((call) => call.url).join("")).not.toContain(SUFFIX);
	});

	it("is breached when the answer lists the rest of the hash with a count", async () => {
		const range = fakeRange({ status: 200, body: `0000000000000000000000000000000000A:3\r\n${SUFFIX}:52579\r\n` });
		await expect(new HibpBreachedPasswordCheck(range.fetchRange).check(PASSWORD)).resolves.toBe("breached");
	});

	it("is clear when the suffix is absent, or present only as a zero-count padding line", async () => {
		await expect(new HibpBreachedPasswordCheck(fakeRange({ status: 200, body: "0000000000000000000000000000000000A:3" }).fetchRange).check(PASSWORD)).resolves.toBe("clear");
		await expect(new HibpBreachedPasswordCheck(fakeRange({ status: 200, body: `${SUFFIX}:0` }).fetchRange).check(PASSWORD)).resolves.toBe("clear");
	});

	it("fails open (unavailable) on an HTTP error or a network failure", async () => {
		await expect(new HibpBreachedPasswordCheck(fakeRange({ status: 503, body: "" }).fetchRange).check(PASSWORD)).resolves.toBe("unavailable");
		await expect(new HibpBreachedPasswordCheck(fakeRange(new Error("ECONNRESET")).fetchRange).check(PASSWORD)).resolves.toBe("unavailable");
	});
});

describe("breachedIn", () => {
	it("ignores malformed lines and surrounding whitespace", () => {
		expect(breachedIn(`garbage\n  ${SUFFIX}:2  \n`, SUFFIX)).toBe(true);
		expect(breachedIn(`${SUFFIX.toLowerCase()}:2`, SUFFIX)).toBe(false);
	});
});

describe("breachedPasswordCheckFor", () => {
	it("picks the adapter PASSWORD_BREACH_CHECK names", async () => {
		expect(breachedPasswordCheckFor("hibp")).toBeInstanceOf(HibpBreachedPasswordCheck);
		const off = breachedPasswordCheckFor("off");
		expect(off).toBeInstanceOf(SkippedBreachedPasswordCheck);
		await expect(off.check(PASSWORD)).resolves.toBe("skipped");
	});
});

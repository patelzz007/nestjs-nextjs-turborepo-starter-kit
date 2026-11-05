import { createHash } from "node:crypto";

import { Logger } from "@nestjs/common";

import type { PasswordBreachCheck } from "../../../../config/api-env.fields";
import type { BreachedPasswordCheckPort, BreachedPasswordVerdict } from "../../application/ports/breached-password.port";

/** Have I Been Pwned's k-anonymity range endpoint: it is sent the first 5 hex characters of the SHA-1 only. */
export const HIBP_RANGE_URL = "https://api.pwnedpasswords.com/range/";
/** Characters of the SHA-1 sent; the other 35 are matched locally against the answer. */
const HASH_PREFIX_LENGTH = 5;
/** How long a sign-up may wait for the answer before the check fails open. */
export const HIBP_TIMEOUT_MS = 2_500;
/** One answer line: the hash suffix and how many breaches it appears in (padding lines have count 0). */
const RANGE_LINE = /^(?<suffix>[0-9A-F]{35}):(?<count>\d+)$/u;

/** The fetch the adapter needs (Node's global `fetch`; a fake in tests). */
export type RangeFetch = (
	url: string,
	init: { readonly headers: Readonly<Record<string, string>>; readonly signal: AbortSignal },
) => Promise<{ readonly ok: boolean; readonly status: number; text(): Promise<string> }>;

/**
 * `PASSWORD_BREACH_CHECK=hibp`. The password's SHA-1 is split: the 5-character prefix is sent (with
 * `Add-Padding`, so the answer's size gives nothing away), the 35-character suffix is looked up in the
 * answer locally. The password, and its full hash, never leave the server. Any failure is `unavailable`.
 */
export class HibpBreachedPasswordCheck implements BreachedPasswordCheckPort {
	private readonly logger: Logger = new Logger(HibpBreachedPasswordCheck.name);

	public constructor(private readonly fetchRange: RangeFetch = fetch) {}

	public async check(password: string): Promise<BreachedPasswordVerdict> {
		const digest: string = createHash("sha1").update(password, "utf8").digest("hex").toUpperCase();
		const prefix: string = digest.slice(0, HASH_PREFIX_LENGTH);
		const suffix: string = digest.slice(HASH_PREFIX_LENGTH);
		try {
			const response = await this.fetchRange(`${HIBP_RANGE_URL}${prefix}`, { headers: { "Add-Padding": "true" }, signal: AbortSignal.timeout(HIBP_TIMEOUT_MS) });
			if (!response.ok) {
				this.logger.warn({ event: "auth.password_breach_check.unavailable", reason: `HTTP ${String(response.status)}` });
				return "unavailable";
			}
			return breachedIn(await response.text(), suffix) ? "breached" : "clear";
		} catch (error: unknown) {
			this.logger.warn({ event: "auth.password_breach_check.unavailable", reason: error instanceof Error ? error.message : "unknown error" });
			return "unavailable";
		}
	}
}

/** Whether the range answer lists `suffix` with a count above zero. */
export function breachedIn(rangeAnswer: string, suffix: string): boolean {
	return rangeAnswer.split(/\r?\n/u).some((line: string): boolean => {
		const groups = RANGE_LINE.exec(line.trim())?.groups;
		return groups?.suffix === suffix && Number(groups.count) > 0;
	});
}

/** `PASSWORD_BREACH_CHECK=off`: nothing is checked. */
export class SkippedBreachedPasswordCheck implements BreachedPasswordCheckPort {
	public check(_password: string): Promise<BreachedPasswordVerdict> {
		return Promise.resolve("skipped");
	}
}

/** The adapter `PASSWORD_BREACH_CHECK` names. */
export function breachedPasswordCheckFor(setting: PasswordBreachCheck): BreachedPasswordCheckPort {
	switch (setting) {
		case "hibp":
			return new HibpBreachedPasswordCheck();
		case "off":
			return new SkippedBreachedPasswordCheck();
	}
}

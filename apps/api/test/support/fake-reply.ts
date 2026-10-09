import { vi } from "vitest";

import type { ExtendedCookieOptions } from "../../src/modules/auth/constants/cookie.config";

/** One cookie the code under test set (`value`) or cleared (`value: null`). */
export interface RecordedCookie {
	readonly name: string;
	readonly value: string | null;
	readonly options: ExtendedCookieOptions;
}

/** The two reply methods the auth cookie code calls, recording every call in order. */
export interface FakeCookieReply {
	readonly cookies: RecordedCookie[];
	readonly setCookie: (name: string, value: string, options: ExtendedCookieOptions) => FakeCookieReply;
	readonly clearCookie: (name: string, options: ExtendedCookieOptions) => FakeCookieReply;
}

/** A Fastify-reply stand-in for interceptor unit tests: records `setCookie` / `clearCookie` instead of writing headers. */
export function fakeCookieReply(): FakeCookieReply {
	const cookies: RecordedCookie[] = [];
	const reply: FakeCookieReply = {
		cookies,
		setCookie: vi.fn((name: string, value: string, options: ExtendedCookieOptions): FakeCookieReply => {
			cookies.push({ name, value, options });
			return reply;
		}),
		clearCookie: vi.fn((name: string, options: ExtendedCookieOptions): FakeCookieReply => {
			cookies.push({ name, value: null, options });
			return reply;
		}),
	};
	return reply;
}

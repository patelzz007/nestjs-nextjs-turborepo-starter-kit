import { describe, expect, it, vi } from "vitest";

interface FakeRequest {
	cookie: string | undefined;
	acceptLanguage: string | null;
}

const request = vi.hoisted((): FakeRequest => ({ cookie: undefined, acceptLanguage: null }));

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
	cookies: (): Promise<{ get: (name: string) => { readonly value: string } | undefined }> =>
		Promise.resolve({ get: (name: string) => (name === "lang" && request.cookie !== undefined ? { value: request.cookie } : undefined) }),
	headers: (): Promise<Headers> => Promise.resolve(new Headers(request.acceptLanguage === null ? {} : { "accept-language": request.acceptLanguage })),
}));

const { readRequestLanguage } = await import("../request-language");

describe("readRequestLanguage", () => {
	it("reads the lang cookie first, then Accept-Language, then English", async () => {
		request.cookie = "zh-Hans";
		request.acceptLanguage = "ms";
		await expect(readRequestLanguage()).resolves.toBe("zh-Hans");
		request.cookie = undefined;
		await expect(readRequestLanguage()).resolves.toBe("ms");
		request.acceptLanguage = null;
		await expect(readRequestLanguage()).resolves.toBe("en");
	});
});

import { describe, expect, it, vi } from "vitest";

const requestHeaders = vi.hoisted(() => ({ current: new Headers() }));

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ headers: (): Promise<Headers> => Promise.resolve(requestHeaders.current) }));

const { nonceProps, readSecurityNonce } = await import("../security-nonce");

describe("readSecurityNonce", () => {
	it("reads the nonce the proxy put on the request, or nothing", async () => {
		requestHeaders.current = new Headers({ "x-nonce": "abc" });
		await expect(readSecurityNonce()).resolves.toBe("abc");
		requestHeaders.current = new Headers();
		await expect(readSecurityNonce()).resolves.toBeUndefined();
	});
});

describe("nonceProps", () => {
	it("passes a nonce on, and nothing when there is none", () => {
		expect(nonceProps("abc")).toStrictEqual({ nonce: "abc" });
		expect(nonceProps(undefined)).toStrictEqual({});
	});
});

import { describe, expect, it } from "vitest";

import { decodeJwtPayload } from "../jwt";

/** Build a JWT string from a payload (base64url header/payload, dummy signature). */
function makeJwt(payload: unknown, header: Record<string, unknown> = { alg: "none", typ: "JWT" }): string {
	const encode = (value: unknown): string => btoa(JSON.stringify(value)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
	return `${encode(header)}.${encode(payload)}.signature`;
}

describe("decodeJwtPayload", () => {
	it("decodes a valid three-part JWT payload", () => {
		const payload = { sub: "u_1", email: "alex@example.com", hasAdminAccess: true };
		expect(decodeJwtPayload(makeJwt(payload))).toEqual(payload);
	});

	it("handles numeric claims (exp/iat) and the URL-safe base64 alphabet", () => {
		const payload = { exp: 1_752_710_400, iat: 1_752_709_900 };
		expect(decodeJwtPayload(makeJwt(payload))).toEqual(payload);
	});

	it("returns null for fewer than three parts", () => {
		expect(decodeJwtPayload("header.payload")).toBeNull();
	});

	it("returns null for more than three parts", () => {
		expect(decodeJwtPayload("a.b.c.d")).toBeNull();
	});

	it("returns null for an empty payload segment", () => {
		expect(decodeJwtPayload("header..signature")).toBeNull();
	});

	it("returns null when the payload is not valid base64", () => {
		expect(decodeJwtPayload("a.%%%%.c")).toBeNull();
	});

	it("returns null when the payload is not a JSON object", () => {
		expect(decodeJwtPayload(makeJwt([1, 2, 3]))).toBeNull();
		expect(decodeJwtPayload(makeJwt("just a string"))).toBeNull();
		expect(decodeJwtPayload(makeJwt(42))).toBeNull();
	});

	it("returns null for empty and degenerate inputs", () => {
		expect(decodeJwtPayload("")).toBeNull();
		expect(decodeJwtPayload("...")).toBeNull();
	});
});

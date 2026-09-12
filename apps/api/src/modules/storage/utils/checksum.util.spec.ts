import { describe, expect, it } from "vitest";

import { sha256Base64ToHex, sha256HexToBase64 } from "./checksum.util";

describe("checksum.util", () => {
	it("round-trips hex and base64 SHA-256 digests", () => {
		const hex = "1789f8b9f648498f5abcfe3c71b7fb4047143b431022d477d27a7acba64d2ca8";
		const base64 = sha256HexToBase64(hex);
		expect(base64).toBe("F4n4ufZISY9avP48cbf7QEcUO0MQItR30np6y6ZNLKg=");
		expect(sha256Base64ToHex(base64)).toBe(hex);
	});
});

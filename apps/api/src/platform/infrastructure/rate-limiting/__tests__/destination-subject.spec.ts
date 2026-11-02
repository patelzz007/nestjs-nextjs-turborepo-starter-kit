import { describe, expect, it } from "vitest";

import { destinationSubject } from "../destination-subject";

const SHA256_HEX = /^[0-9a-f]{64}$/;

describe("destinationSubject", () => {
	it("is a SHA-256 of the normalized destination, never the destination itself", () => {
		const subject = destinationSubject("  Jane@Example.com ");
		expect(subject.kind).toBe("destination");
		expect(subject.id).toMatch(SHA256_HEX);
		expect(subject.id).toBe(destinationSubject("jane@example.com").id);
		expect(subject.id).not.toContain("example");
	});
});

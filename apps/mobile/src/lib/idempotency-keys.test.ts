import { IdempotencyKeyRing } from "./idempotency-keys";

function ring(): IdempotencyKeyRing {
	let next = 0;
	return new IdempotencyKeyRing((): string => {
		next += 1;
		return `key-${String(next)}`;
	});
}

describe("IdempotencyKeyRing", () => {
	it("reuses the key when the same payload is sent again after a failure", () => {
		const keys = ring();

		expect(keys.keyFor('{"body":"Hi"}')).toBe("key-1");
		expect(keys.keyFor('{"body":"Hi"}')).toBe("key-1");
	});

	it("gives changed text a new key — the API refuses a key reused for another body", () => {
		const keys = ring();
		keys.keyFor('{"body":"Hi"}');

		expect(keys.keyFor('{"body":"Hi there"}')).toBe("key-2");
	});

	it("spends the key on success, so the same text sent again is a new comment", () => {
		const keys = ring();
		keys.keyFor('{"body":"Hi"}');

		keys.spend();

		expect(keys.keyFor('{"body":"Hi"}')).toBe("key-2");
	});
});

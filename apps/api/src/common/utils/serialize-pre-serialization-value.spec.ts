import { describe, expect, it } from "vitest";

import { serializePreSerializationValue } from "./serialize-pre-serialization-value";

describe("serializePreSerializationValue", () => {
	it("converts bigint values to numbers", () => {
		expect(serializePreSerializationValue(BigInt(42))).toBe(42);
		expect(serializePreSerializationValue({ count: BigInt(7) })).toEqual({ count: 7 });
	});

	it("omits undefined optional object properties", () => {
		const payload = {
			success: true,
			data: {
				id: "user-1",
				isImpersonating: undefined,
				originalUserId: undefined,
			},
		};

		expect(serializePreSerializationValue(payload)).toEqual({
			success: true,
			data: {
				id: "user-1",
			},
		});
	});

	it("preserves primitives, arrays, and nested objects", () => {
		const payload = {
			items: [{ id: BigInt(1) }, { id: 2 }],
			meta: { active: true, label: null },
		};

		expect(serializePreSerializationValue(payload)).toEqual({
			items: [{ id: 1 }, { id: 2 }],
			meta: { active: true, label: null },
		});
	});
});

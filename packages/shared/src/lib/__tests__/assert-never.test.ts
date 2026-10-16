import { describe, expect, it } from "vitest";

import { assertNever } from "./assert-never";

interface Circle {
	readonly kind: "circle";
	readonly radius: number;
}

interface Square {
	readonly kind: "square";
	readonly side: number;
}

type Shape = Circle | Square;

function area(shape: Shape): number {
	switch (shape.kind) {
		case "circle":
			return Math.PI * shape.radius ** 2;
		case "square":
			return shape.side ** 2;
		default:
			return assertNever(shape, "shape");
	}
}

/**
 * Type guards that never match — after both, the compiler has narrowed the
 * value to `never` while the real object is still there at runtime: exactly
 * the "value slipped past the types" situation assertNever must catch.
 */
function isCircleNever(_shape: Shape): _shape is Circle {
	return false;
}

function isSquareNever(_shape: Shape): _shape is Square {
	return false;
}

function describeUnmatched(shape: Shape): string {
	if (isCircleNever(shape) || isSquareNever(shape)) {
		return "matched";
	}
	return assertNever(shape, "shape");
}

describe("assertNever", () => {
	it("is unreachable for every handled variant", () => {
		expect(area({ kind: "square", side: 3 })).toBe(9);
	});

	it("throws naming the subject and the unhandled value when a variant slips through at runtime", () => {
		expect(() => describeUnmatched({ kind: "circle", radius: 1 })).toThrow('Unhandled shape: {"kind":"circle","radius":1}');
	});
});

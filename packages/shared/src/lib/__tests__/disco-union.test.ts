import { describe, expectTypeOf, it } from "vitest";

import type { Prettify, ToDiscoUnion } from "./disco-union";

describe("ToDiscoUnion (compile-time)", () => {
	it("tags every variant with its name under `type`", () => {
		type State = ToDiscoUnion<{ loading: object; error: { message: string }; complete: { name: string } }>;

		expectTypeOf<State>().toEqualTypeOf<{ readonly type: "loading" } | { readonly type: "error"; message: string } | { readonly type: "complete"; name: string }>();
	});

	it("uses the discriminant key a union already has, so its shape does not change", () => {
		type Outcome = ToDiscoUnion<{ done: { readonly value: number }; failed: { readonly reason: string } }, "kind">;

		expectTypeOf<Outcome>().toEqualTypeOf<{ readonly kind: "done"; readonly value: number } | { readonly kind: "failed"; readonly reason: string }>();
	});

	it("narrows on the discriminant", () => {
		type State = ToDiscoUnion<{ error: { message: string }; complete: { name: string } }>;
		function describe(state: State): string {
			if (state.type === "error") {
				expectTypeOf(state).toEqualTypeOf<{ readonly type: "error"; message: string }>();
				return state.message;
			}
			expectTypeOf(state).toEqualTypeOf<{ readonly type: "complete"; name: string }>();
			return state.name;
		}
		expectTypeOf(describe).returns.toEqualTypeOf<string>();
	});
});

describe("Prettify (compile-time)", () => {
	it("flattens an intersection into one object type", () => {
		expectTypeOf<Prettify<{ a: string } & { b: number }>>().toEqualTypeOf<{ a: string; b: number }>();
	});
});

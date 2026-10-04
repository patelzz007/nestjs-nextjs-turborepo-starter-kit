import { statefulIsAuthorized } from "@cedar-policy/cedar-wasm/nodejs";
import { describe, expect, it } from "vitest";

import { MAX_PREPARSED_POLICY_SETS, PREPARSED_POLICY_SET_CACHE, PreparsedPolicySetCache } from "./preparsed-policy-set-cache";
import { PolicyEngineError } from "./policy-engine.port";

const CAPACITY = 3;
const DISTINCT_BUNDLES = 50;

/** A distinct, valid bundle per index: permits only when the action id is `a<index>`. */
function bundleText(index: number): string {
	return `permit(principal, action == Action::"a${String(index)}", resource);`;
}

/** Decision of the preparsed set in `slot` for action `a<index>`. */
function decides(slot: string, index: number): string {
	const answer = statefulIsAuthorized({
		principal: { type: "User", id: "u" },
		action: { type: "Action", id: `a${String(index)}` },
		resource: { type: "Resource", id: "r" },
		context: {},
		preparsedPolicySetId: slot,
		entities: [],
	});
	return answer.type === "success" ? answer.response.decision : "failure";
}

describe("PreparsedPolicySetCache", () => {
	it("never holds more bundles than its capacity, however many distinct bundles are evaluated", () => {
		const cache = new PreparsedPolicySetCache(CAPACITY, "spec-bounded-");
		const slots = new Set<string>();
		for (let index = 0; index < DISTINCT_BUNDLES; index += 1) {
			slots.add(cache.slotFor(bundleText(index)));
			expect(cache.size).toBeLessThanOrEqual(CAPACITY);
		}
		// Only CAPACITY wasm-side policy sets ever exist: slots are reused, never added.
		expect(slots.size).toBe(CAPACITY);
	});

	it("evaluates the CURRENT bundle of a reused slot and re-parses an evicted bundle correctly", () => {
		const cache = new PreparsedPolicySetCache(CAPACITY, "spec-reuse-");
		const first = cache.slotFor(bundleText(0));
		for (let index = 1; index <= CAPACITY; index += 1) {
			cache.slotFor(bundleText(index));
		}
		// Bundle 0 was the least recently used: its slot now holds bundle CAPACITY.
		expect(decides(first, CAPACITY)).toBe("allow");
		expect(decides(first, 0)).toBe("deny");
		// Asking for bundle 0 again parses it into a slot that evaluates it.
		expect(decides(cache.slotFor(bundleText(0)), 0)).toBe("allow");
		expect(cache.size).toBe(CAPACITY);
	});

	it("keeps recently used bundles (LRU, not FIFO)", () => {
		const cache = new PreparsedPolicySetCache(2, "spec-lru-");
		const zero = cache.slotFor(bundleText(0));
		cache.slotFor(bundleText(1));
		expect(cache.slotFor(bundleText(0))).toBe(zero);
		cache.slotFor(bundleText(2));
		// Bundle 1 (not bundle 0) was evicted.
		expect(cache.slotFor(bundleText(0))).toBe(zero);
		expect(decides(zero, 0)).toBe("allow");
	});

	it("rejects an unparsable bundle without occupying a slot, and a non-positive capacity", () => {
		const cache = new PreparsedPolicySetCache(CAPACITY, "spec-invalid-");
		expect(() => cache.slotFor("permit(principal, action")).toThrow(PolicyEngineError);
		expect(cache.size).toBe(0);
		expect(() => new PreparsedPolicySetCache(0)).toThrow();
	});

	it("bounds the process-wide cache by the named limit", () => {
		expect(PREPARSED_POLICY_SET_CACHE.size).toBeLessThanOrEqual(MAX_PREPARSED_POLICY_SETS);
	});
});

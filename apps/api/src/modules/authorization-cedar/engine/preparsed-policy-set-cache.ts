import { createHash } from "node:crypto";

import { preparsePolicySet, type DetailedError } from "@cedar-policy/cedar-wasm/nodejs";

import { PolicyEngineError } from "./policy-engine.port";

/**
 * Upper bound on policy sets kept parsed inside the Cedar wasm module.
 *
 * cedar-wasm 4.13.0 has no API to DROP a preparsed policy set; every new id
 * stays in wasm memory forever (measured: ~0.26 MB per 200-policy set, 2,000
 * distinct ids grew RSS by 517 MB). Re-preparsing an EXISTING id replaces its
 * entry, and memory then stays flat (measured: overwriting 16 ids 10,000
 * times grew RSS by 47 MB once, then 0). So the cache owns a fixed pool of
 * slot ids and reuses the least-recently-used slot for a new bundle.
 */
export const MAX_PREPARSED_POLICY_SETS = 256;

/** Slot-id prefix of the process-wide cache. */
export const DEFAULT_SLOT_ID_PREFIX = "rewardhub-bundle-slot-";

function messagesOf(errors: readonly DetailedError[]): string[] {
	return errors.map((error: DetailedError): string => error.message);
}

/**
 * LRU map from bundle text (content hash) to one of a FIXED pool of preparsed
 * policy-set slot ids. The wasm module's preparsed sets are process-global, so
 * one cache instance ({@link PREPARSED_POLICY_SET_CACHE}) serves every engine
 * instance — two caches would overwrite each other's slots.
 *
 * Measured per call (two-policy bundle): stateful evaluation 17.6 µs,
 * stateless `isAuthorized` 73.1 µs, re-preparse 55.3 µs — so a miss costs one
 * preparse and every hit stays on the fast stateful path.
 */
export class PreparsedPolicySetCache {
	/** bundle hash → slot id; Map iteration order is least- to most-recently used. */
	private readonly slotsByBundle: Map<string, string> = new Map<string, string>();
	private nextSlot = 0;

	public constructor(
		private readonly capacity: number = MAX_PREPARSED_POLICY_SETS,
		/** Distinct per cache: two caches sharing slot ids would overwrite each other's policy sets. */
		private readonly slotIdPrefix: string = DEFAULT_SLOT_ID_PREFIX,
	) {
		if (!Number.isInteger(capacity) || capacity < 1) {
			throw new Error(`Preparsed policy-set cache capacity must be a positive integer, got ${String(capacity)}`);
		}
	}

	/** Number of bundles currently parsed (never above the capacity). */
	public get size(): number {
		return this.slotsByBundle.size;
	}

	/** The preparsed slot id holding `policyText`, parsing it (into a free or the LRU slot) on a miss. */
	public slotFor(policyText: string): string {
		const bundleHash: string = createHash("sha256").update(policyText).digest("hex");
		const cached: string | undefined = this.slotsByBundle.get(bundleHash);
		if (cached !== undefined) {
			this.slotsByBundle.delete(bundleHash);
			this.slotsByBundle.set(bundleHash, cached);
			return cached;
		}
		const slot: string = this.claimSlot();
		const answer = preparsePolicySet(slot, { staticPolicies: policyText });
		if (answer.type === "failure") {
			throw new PolicyEngineError("A published policy does not parse", messagesOf(answer.errors));
		}
		this.slotsByBundle.set(bundleHash, slot);
		return slot;
	}

	/** A fresh slot while below capacity, otherwise the least-recently-used bundle's slot (that bundle is evicted). */
	private claimSlot(): string {
		if (this.nextSlot < this.capacity) {
			const slot = `${this.slotIdPrefix}${String(this.nextSlot)}`;
			this.nextSlot += 1;
			return slot;
		}
		const oldest: [string, string] | undefined = this.slotsByBundle.entries().next().value;
		if (oldest === undefined) {
			throw new Error("Preparsed policy-set cache has no slot to reuse");
		}
		this.slotsByBundle.delete(oldest[0]);
		return oldest[1];
	}
}

/** The process-wide cache (the wasm module's preparsed sets are process-global). */
export const PREPARSED_POLICY_SET_CACHE: PreparsedPolicySetCache = new PreparsedPolicySetCache();

// ============================================
// domain/access/access-decider.ts — deny by default, allow by exactly one of four paths (ADR 067)
// ============================================
// Design patterns:
//   - STRATEGY host / CHAIN: the paths are tried in order; the first that allows
//     answers, and names itself so audits and tests can assert WHY.
//   - Open/Closed + Liskov: any `AllowPath` can be added or swapped (tests pass
//     fakes) without this class changing.
//   - A pure DOMAIN SERVICE: no I/O of its own — the facts and `now` are inputs,
//     which makes every expiry boundary testable with a fixed clock.

import type { EpochMs } from "@workspace/shared";

import type { AccessFacts } from "./access-facts";
import { DENIED, type AccessDecision, type AccessRequest } from "./access-request";
import type { AllowPath } from "./allow-paths";

export class AccessDecider {
	public constructor(private readonly paths: readonly AllowPath[]) {}

	/** The first path that allows the request, or a denial: nothing is allowed unless a path says so. */
	public async decide(request: AccessRequest, facts: AccessFacts, now: EpochMs): Promise<AccessDecision> {
		for (const path of this.paths) {
			if (await path.allows(request, facts, now)) {
				return { allowed: true, path: path.name };
			}
		}
		return DENIED;
	}
}

import type { EpochMs } from "@workspace/shared";

import type { Clock } from "../clock.port";

/** Clock frozen at one epoch millisecond for deterministic handler and aggregate tests. */
export class FixedClock implements Clock {
	public constructor(private readonly instant: EpochMs) {}

	public now(): EpochMs {
		return this.instant;
	}
}

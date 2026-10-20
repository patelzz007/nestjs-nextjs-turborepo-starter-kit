import type { EpochMs } from "@workspace/shared";

export interface Clock {
	now(): EpochMs;
}

export const CLOCK = Symbol("CLOCK");

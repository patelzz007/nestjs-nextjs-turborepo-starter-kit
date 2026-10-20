import { Injectable } from "@nestjs/common";
import { nowEpochMs, type EpochMs } from "@workspace/shared";

import type { Clock } from "../application/clock.port";

@Injectable()
export class SystemClock implements Clock {
	public now(): EpochMs {
		return nowEpochMs();
	}
}

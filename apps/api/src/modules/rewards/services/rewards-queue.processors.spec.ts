import { describe, expect, it } from "vitest";

import * as outboxProcessors from "../../../infrastructure/outbox/outbox-queue.processors";
import * as rewardsProcessors from "./rewards-queue.processors";

describe("BullMQ scheduler iteration detection", () => {
	it("detects repeat iterations created by job schedulers", () => {
		expect(rewardsProcessors.isSchedulerIterationJob("repeat:outbox-publish:1790119565000")).toBe(true);
		expect(rewardsProcessors.isSchedulerIterationJob("repeat:claims-expire-referrer:1790119702481")).toBe(true);
		expect(rewardsProcessors.isSchedulerIterationJob("manual-job-123")).toBe(false);
		expect(outboxProcessors.isSchedulerIterationJob("repeat:outbox-publish:1790288836790")).toBe(true);
	});

	it("matches only the scheduler id it belongs to", () => {
		expect(rewardsProcessors.isSchedulerIterationFor("repeat:outbox-publish:1790119565000", "outbox-publish")).toBe(true);
		expect(rewardsProcessors.isSchedulerIterationFor("repeat:claims-expire-referrer:1790119702481", "outbox-publish")).toBe(false);
		expect(rewardsProcessors.isSchedulerIterationFor(undefined, "outbox-publish")).toBe(false);
		expect(outboxProcessors.isSchedulerIterationFor("repeat:outbox-publish:1790288836790", "outbox-publish")).toBe(true);
		expect(outboxProcessors.isSchedulerIterationFor("repeat:other-scheduler:1790119565000", "outbox-publish")).toBe(false);
	});
});

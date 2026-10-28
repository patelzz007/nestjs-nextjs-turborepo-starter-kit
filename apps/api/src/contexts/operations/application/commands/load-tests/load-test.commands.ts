// ============================================
// application/commands/load-tests/load-test.commands.ts — the load-test commands (ADR 068)
// ============================================

import { Command } from "@nestjs/cqrs";
import type { LoadTestCaps, LoadTestPurgeResult, LoadTestRun, StartLoadTestInput } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

/** `POST /admin/operations/load-tests`: start one load test. */
export class StartLoadTestCommand extends Command<LoadTestRun> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: StartLoadTestInput,
	) {
		super();
	}
}

/** `POST /admin/operations/load-tests/:runId/abort`: stop a queued or running load test. */
export class AbortLoadTestCommand extends Command<LoadTestRun> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly runId: string,
	) {
		super();
	}
}

/** `PUT /admin/operations/load-tests/caps` (SuperAdmin): the load-test caps. */
export class UpdateLoadTestCapsCommand extends Command<LoadTestCaps> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly caps: LoadTestCaps,
	) {
		super();
	}
}

/** `DELETE /admin/operations/load-tests/data` (SuperAdmin): the hard-delete purge (ADR 068, exception 2). */
export class PurgeLoadTestDataCommand extends Command<LoadTestPurgeResult> {
	public constructor(public readonly actor: ActorContext) {
		super();
	}
}

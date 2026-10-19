import { CqrsModule } from "@nestjs/cqrs";
import { Test } from "@nestjs/testing";
import { describe, expect, it } from "vitest";

import { RECORDING_COMMAND_DISPATCHER, RecordingCommandDispatcher } from "../../../../../../test/support/recording-command-dispatcher";
import { CLOCK } from "../../../../../platform/application/clock.port";
import { InMemoryClaimsStore } from "../../../application/__tests__/fakes/claims.fakes";
import { SweepSignupSuccessNoticesCommand } from "../../../application/commands/sweep-signup-success-notices/sweep-signup-success-notices.command";
import { SweepSignupSuccessNoticesHandler } from "../../../application/commands/sweep-signup-success-notices/sweep-signup-success-notices.handler";
import { CLAIMS_UNIT_OF_WORK } from "../../../application/ports/claims.tokens";
import { SIGNUP_SUCCESS_NOTICE_OPERATION, SignupSuccessNoticesFailedError } from "../../../application/services/signup-success-notice.application-service";
import { SignupSuccessNoticesCron } from "../signup-success-notices.cron";

describe("SignupSuccessNoticesCron", () => {
	async function cronWith(store: InMemoryClaimsStore): Promise<{ readonly cron: SignupSuccessNoticesCron; readonly dispatcher: RecordingCommandDispatcher }> {
		const moduleRef = await Test.createTestingModule({
			imports: [CqrsModule.forRoot()],
			providers: [
				RECORDING_COMMAND_DISPATCHER,
				SweepSignupSuccessNoticesHandler,
				{ provide: CLAIMS_UNIT_OF_WORK, useValue: store.uow },
				{ provide: CLOCK, useValue: store.clock },
			],
		}).compile();
		await moduleRef.init();
		const dispatcher = moduleRef.get(RecordingCommandDispatcher);
		return { cron: new SignupSuccessNoticesCron(dispatcher), dispatcher };
	}

	it("dispatches the sweep as the notice cron system operation", async () => {
		const store = new InMemoryClaimsStore();
		store.signupSuccessNotices.succeed("signup-referral-1", "referrer-1", "referee-1");
		store.claimants.names.set("referee-1", "Aisha Rahman");
		const { cron, dispatcher } = await cronWith(store);

		await expect(cron.sweep()).resolves.toBeUndefined();

		expect(dispatcher.dispatched.map(({ command, origin }) => [command.constructor, origin])).toEqual([
			[SweepSignupSuccessNoticesCommand, { kind: "cron", name: "SignupSuccessNoticesCron.sweep" }],
		]);
		expect(dispatcher.dispatched.at(0)?.command).toMatchObject({ actor: { kind: "system", operation: SIGNUP_SUCCESS_NOTICE_OPERATION, origin: "cron" } });
		expect(store.inbox.notices).toHaveLength(1);
	});

	it("rethrows a run with failures (the dispatcher already audited it as failed)", async () => {
		const store = new InMemoryClaimsStore();
		store.signupSuccessNotices.succeed("signup-referral-1", "referrer-1", "referee-gone");
		const { cron } = await cronWith(store);

		await expect(cron.sweep()).rejects.toBeInstanceOf(SignupSuccessNoticesFailedError);
	});
});

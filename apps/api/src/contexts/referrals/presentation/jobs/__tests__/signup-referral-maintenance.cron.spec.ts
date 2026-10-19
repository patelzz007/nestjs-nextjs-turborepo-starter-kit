import { epochMs } from "@workspace/shared";
import { CqrsModule } from "@nestjs/cqrs";
import { Test } from "@nestjs/testing";
import { describe, expect, it } from "vitest";

import { FixedClock } from "../../../../../platform/application/__tests__/fixed-clock";
import { CLOCK } from "../../../../../platform/application/clock.port";
import { RECORDING_COMMAND_DISPATCHER, RecordingCommandDispatcher } from "../../../../../../test/support/recording-command-dispatcher";
import { MaintainSignupReferralCodesCommand } from "../../../application/commands/maintain-signup-referral-codes/maintain-signup-referral-codes.command";
import { MaintainSignupReferralCodesHandler } from "../../../application/commands/maintain-signup-referral-codes/maintain-signup-referral-codes.handler";
import { SignupReferralJobItemsFailedError } from "../../../application/errors/signup-referral.errors";
import { ScriptedCodeMaintenance } from "../../../application/__tests__/fakes/referrals.fakes";
import { SIGNUP_REFERRAL_CODE_MAINTENANCE } from "../../../application/ports/referrals.tokens";
import { SignupReferralMaintenanceCron } from "../signup-referral-maintenance.cron";

const NOW = epochMs(1_800_000_000_000);

async function cronWith(codes: ScriptedCodeMaintenance): Promise<{ readonly cron: SignupReferralMaintenanceCron; readonly dispatcher: RecordingCommandDispatcher }> {
	const moduleRef = await Test.createTestingModule({
		imports: [CqrsModule.forRoot()],
		providers: [
			RECORDING_COMMAND_DISPATCHER,
			MaintainSignupReferralCodesHandler,
			{ provide: SIGNUP_REFERRAL_CODE_MAINTENANCE, useValue: codes },
			{ provide: CLOCK, useValue: new FixedClock(NOW) },
		],
	}).compile();
	await moduleRef.init();
	const dispatcher = moduleRef.get(RecordingCommandDispatcher);
	return { cron: new SignupReferralMaintenanceCron(dispatcher), dispatcher };
}

describe("SignupReferralMaintenanceCron", () => {
	it("dispatches the code job as the code-maintenance cron system operation", async () => {
		const codes = new ScriptedCodeMaintenance([["user-1"]], new Map([["user-1", "first"]]));
		const { cron, dispatcher } = await cronWith(codes);

		await expect(cron.maintain()).resolves.toBeUndefined();

		expect(dispatcher.dispatched.map(({ command, origin }) => [command.constructor, origin])).toEqual([
			[MaintainSignupReferralCodesCommand, { kind: "cron", name: "SignupReferralMaintenanceCron.maintain" }],
		]);
		expect(dispatcher.dispatched.at(0)?.command).toMatchObject({ actor: { kind: "system", operation: "maintenance.signup_referral_codes", origin: "cron" } });
		expect(codes.issued).toEqual(["user-1"]);
	});

	it("rethrows a run with failures (the dispatcher already audited it as failed)", async () => {
		const { cron } = await cronWith(new ScriptedCodeMaintenance([["user-1"]], new Map([["user-1", new Error("allocation failed")]])));

		await expect(cron.maintain()).rejects.toBeInstanceOf(SignupReferralJobItemsFailedError);
	});
});

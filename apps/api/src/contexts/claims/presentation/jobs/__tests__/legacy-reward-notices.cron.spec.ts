import { CqrsModule } from "@nestjs/cqrs";
import { Test } from "@nestjs/testing";
import { describe, expect, it } from "vitest";

import { RECORDING_COMMAND_DISPATCHER, RecordingCommandDispatcher } from "../../../../../../e2e/support/recording-command-dispatcher";
import { CLOCK } from "../../../../../platform/application/clock.port";
import { InMemoryClaimsStore, NOW } from "../../../application/__tests__/fakes/claims.fakes";
import { MigrateLegacyRewardNoticesCommand } from "../../../application/commands/migrate-legacy-reward-notices/migrate-legacy-reward-notices.command";
import { MigrateLegacyRewardNoticesHandler } from "../../../application/commands/migrate-legacy-reward-notices/migrate-legacy-reward-notices.handler";
import { CLAIMS_UNIT_OF_WORK } from "../../../application/ports/claims.tokens";
import { LEGACY_REWARD_NOTICE_MIGRATION_OPERATION } from "../../../application/services/legacy-reward-notice-migration";
import { LegacyRewardNoticesCron } from "../legacy-reward-notices.cron";

describe("LegacyRewardNoticesCron", () => {
	it("dispatches the move as the legacy-inbox system operation and moves the waiting rows", async () => {
		const store = new InMemoryClaimsStore();
		store.legacyNotices.add({
			id: "legacy-1",
			userId: "user-1",
			type: "claim_confirmed",
			title: "Claim confirmed",
			body: "Ready",
			metadata: {},
			readAt: null,
			createdAt: NOW - 1,
		});
		const moduleRef = await Test.createTestingModule({
			imports: [CqrsModule.forRoot()],
			providers: [
				RECORDING_COMMAND_DISPATCHER,
				MigrateLegacyRewardNoticesHandler,
				{ provide: CLAIMS_UNIT_OF_WORK, useValue: store.uow },
				{ provide: CLOCK, useValue: store.clock },
			],
		}).compile();
		await moduleRef.init();
		const dispatcher = moduleRef.get(RecordingCommandDispatcher);

		await expect(new LegacyRewardNoticesCron(dispatcher).migrate()).resolves.toBeUndefined();

		expect(dispatcher.dispatched.map(({ command, origin }) => [command.constructor, origin])).toEqual([
			[MigrateLegacyRewardNoticesCommand, { kind: "cron", name: "LegacyRewardNoticesCron.migrate" }],
		]);
		expect(dispatcher.dispatched.at(0)?.command).toMatchObject({ actor: { kind: "system", operation: LEGACY_REWARD_NOTICE_MIGRATION_OPERATION, origin: "cron" } });
		expect(store.legacyInbox.imported.map((notice) => notice.legacyId)).toEqual(["legacy-1"]);
	});
});

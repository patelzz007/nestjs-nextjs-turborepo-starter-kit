import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import type { EpochMs } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";
import { CLOCK, type Clock } from "../../../../../platform/application/clock.port";
import type { UnitOfWork } from "../../../../../platform/application/unit-of-work.port";
import { AllDeviceSessionsSignedOut, DeviceSessionsRevoked } from "../../../domain/events/identity.events";
import { revokedByUser } from "../../../domain/value-objects/session-revoker.value-object";
import type { IdentityScope } from "../../identity-scope";
import { IDENTITY_UNIT_OF_WORK } from "../../ports/identity.tokens";
import { LogOutAllDevicesCommand } from "./log-out-all-devices.command";

/** Signs out every session of the user on every client type: revocation, `tokenVersion` bump and the outbox event commit together. */
@CommandHandler(LogOutAllDevicesCommand)
export class LogOutAllDevicesHandler implements ICommandHandler<LogOutAllDevicesCommand, void> {
	public constructor(
		@Inject(IDENTITY_UNIT_OF_WORK) private readonly uow: UnitOfWork<IdentityScope>,
		@Inject(CLOCK) private readonly clock: Clock,
	) {}

	public async execute(command: LogOutAllDevicesCommand): Promise<void> {
		const { input } = command;
		const startedAt: EpochMs = this.clock.now();
		const actor: ActorContext = command.actor;
		await this.uow.run(actor, async (scope: IdentityScope): Promise<void> => {
			const now: EpochMs = this.clock.now();
			await scope.sessions.revokeAllOf([input.userId], revokedByUser(input.userId), now, null);
			await scope.accounts.bumpTokenVersions([input.userId], now);
			scope.events.collect(new AllDeviceSessionsSignedOut(input.userId, startedAt, now));
			scope.events.collect(new DeviceSessionsRevoked([input.userId], "logout_all_devices", now));
		});
	}
}

import { Inject, Logger } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";

import { CLOCK, type Clock } from "../../../../../platform/application/clock.port";
import type { UnitOfWork } from "../../../../../platform/application/unit-of-work.port";
import { WEB_AUTHN_CHALLENGE_RETENTION_MS } from "../../../domain/aggregates/web-authn-challenge.aggregate";
import type { IdentityScope } from "../../identity-scope";
import { IDENTITY_UNIT_OF_WORK, WEB_AUTHN_CHALLENGE_CLEANUP_OPERATION } from "../../ports/identity.tokens";
import { PurgeStaleWebAuthnChallengesCommand } from "./purge-stale-web-authn-challenges.command";

/**
 * Cron: soft-deletes (never DELETEs) WebAuthn challenges an hour past their five-minute expiry — one
 * set-based write. The passwordless options endpoint is public, so this bounds what it can accumulate.
 */
@CommandHandler(PurgeStaleWebAuthnChallengesCommand)
export class PurgeStaleWebAuthnChallengesHandler implements ICommandHandler<PurgeStaleWebAuthnChallengesCommand, number> {
	private readonly logger: Logger = new Logger(PurgeStaleWebAuthnChallengesHandler.name);

	public constructor(
		@Inject(IDENTITY_UNIT_OF_WORK) private readonly uow: UnitOfWork<IdentityScope>,
		@Inject(CLOCK) private readonly clock: Clock,
	) {}

	public async execute(command: PurgeStaleWebAuthnChallengesCommand): Promise<number> {
		const retired: number = await this.uow.runSystemOperation(WEB_AUTHN_CHALLENGE_CLEANUP_OPERATION, command.actor, (scope: IdentityScope) =>
			scope.webAuthnChallenges.retireExpired(this.clock.now(), WEB_AUTHN_CHALLENGE_RETENTION_MS),
		);
		if (retired > 0) {
			this.logger.log({ event: "auth.web_authn_challenges.retired", retired });
		}
		return retired;
	}
}

import { Inject, Logger } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import type { PasskeyMessageResponse } from "@workspace/shared";

import { CLOCK, type Clock } from "../../../../../platform/application/clock.port";
import type { UnitOfWork } from "../../../../../platform/application/unit-of-work.port";
import type { Passkey } from "../../../domain/aggregates/passkey.aggregate";
import type { UserAccount } from "../../../domain/aggregates/user-account.aggregate";
import { PasskeyNotFoundError } from "../../../domain/errors/identity.errors";
import type { IdentityScope } from "../../identity-scope";
import { IDENTITY_UNIT_OF_WORK } from "../../ports/identity.tokens";
import { assertPasskeyChangeAllowed } from "../../services/passkey-ceremony";
import { RemovePasskeyCommand } from "./remove-passkey.command";

const REMOVED_RESPONSE: PasskeyMessageResponse = { message: "Passkey removed" };

/**
 * Removes one of the caller's passkeys: soft delete, attributed to the caller, with the owner's notice in the
 * same transaction. The password and the other factors keep working, so removing the last passkey never
 * locks anyone out (ADR 080). Any id that is not one of the caller's live passkeys is 404.
 */
@CommandHandler(RemovePasskeyCommand)
export class RemovePasskeyHandler implements ICommandHandler<RemovePasskeyCommand, PasskeyMessageResponse> {
	private readonly logger: Logger = new Logger(RemovePasskeyHandler.name);

	public constructor(
		@Inject(IDENTITY_UNIT_OF_WORK) private readonly uow: UnitOfWork<IdentityScope>,
		@Inject(CLOCK) private readonly clock: Clock,
	) {}

	public async execute(command: RemovePasskeyCommand): Promise<PasskeyMessageResponse> {
		const { actor, input } = command;
		assertPasskeyChangeAllowed(actor);
		await this.uow.run(actor, async (scope: IdentityScope): Promise<void> => {
			const passkey: Passkey | null = await scope.passkeys.findLiveById(input.passkeyId);
			if (passkey === null || !passkey.isOwnedBy(input.userId)) {
				throw new PasskeyNotFoundError();
			}
			passkey.remove(input.userId, this.clock.now());
			await scope.passkeys.save(passkey);
			const account: UserAccount | null = await scope.accounts.findById(input.userId);
			if (account !== null) {
				await scope.emails.sendPasskeyRemovedEmail(account.email.value, passkey.name);
			}
		});
		this.logger.log({ event: "passkey.removed", userId: input.userId, passkeyId: input.passkeyId });
		return REMOVED_RESPONSE;
	}
}

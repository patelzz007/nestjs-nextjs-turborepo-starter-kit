import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import type { Passkey as PasskeyView } from "@workspace/shared";

import { CLOCK, type Clock } from "../../../../../platform/application/clock.port";
import type { UnitOfWork } from "../../../../../platform/application/unit-of-work.port";
import type { Passkey } from "../../../domain/aggregates/passkey.aggregate";
import { PasskeyNotFoundError } from "../../../domain/errors/identity.errors";
import type { IdentityScope } from "../../identity-scope";
import { IDENTITY_UNIT_OF_WORK } from "../../ports/identity.tokens";
import { assertPasskeyChangeAllowed, toPasskeyView } from "../../services/passkey-ceremony";
import { RenamePasskeyCommand } from "./rename-passkey.command";

/** Renames one of the caller's passkeys. Any id that is not one of the caller's live passkeys is 404, never 403. */
@CommandHandler(RenamePasskeyCommand)
export class RenamePasskeyHandler implements ICommandHandler<RenamePasskeyCommand, PasskeyView> {
	public constructor(
		@Inject(IDENTITY_UNIT_OF_WORK) private readonly uow: UnitOfWork<IdentityScope>,
		@Inject(CLOCK) private readonly clock: Clock,
	) {}

	public async execute(command: RenamePasskeyCommand): Promise<PasskeyView> {
		const { actor, input } = command;
		assertPasskeyChangeAllowed(actor);
		return this.uow.run(actor, async (scope: IdentityScope): Promise<PasskeyView> => {
			const passkey: Passkey | null = await scope.passkeys.findLiveById(input.passkeyId);
			if (passkey === null || !passkey.isOwnedBy(input.userId)) {
				throw new PasskeyNotFoundError();
			}
			passkey.rename(input.name, this.clock.now());
			await scope.passkeys.save(passkey);
			return toPasskeyView(passkey);
		});
	}
}

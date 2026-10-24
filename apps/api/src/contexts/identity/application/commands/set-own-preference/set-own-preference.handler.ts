import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import { parseUserPreferenceValue, type UserPreference } from "@workspace/shared";

import type { UnitOfWork } from "../../../../../platform/application/unit-of-work.port";
import { PreferenceValueInvalidError } from "../../../domain/errors/identity.errors";
import type { IdentityScope } from "../../identity-scope";
import type { IdGeneratorPort } from "../../ports/id-generator.port";
import { ID_GENERATOR, IDENTITY_UNIT_OF_WORK } from "../../ports/identity.tokens";
import { SetOwnPreferenceCommand } from "./set-own-preference.command";

/**
 * Remembers one choice of the signed-in user (a board's grouping, "Show
 * subtasks"). The value is checked against the shared registry again here —
 * never trusting the client's check (400 when the key does not accept it) — and
 * written to the user's own row under RLS; the HTTP audit records the request.
 */
@CommandHandler(SetOwnPreferenceCommand)
export class SetOwnPreferenceHandler implements ICommandHandler<SetOwnPreferenceCommand, UserPreference> {
	public constructor(
		@Inject(IDENTITY_UNIT_OF_WORK) private readonly uow: UnitOfWork<IdentityScope>,
		@Inject(ID_GENERATOR) private readonly ids: IdGeneratorPort,
	) {}

	public async execute(command: SetOwnPreferenceCommand): Promise<UserPreference> {
		const { key, value } = command.input;
		const accepted = parseUserPreferenceValue(key, value);
		if (accepted === null) {
			throw new PreferenceValueInvalidError(key);
		}
		return this.uow.run(command.actor, (scope: IdentityScope): Promise<UserPreference> => scope.preferences.set(this.ids.next(), command.userId, key, accepted));
	}
}

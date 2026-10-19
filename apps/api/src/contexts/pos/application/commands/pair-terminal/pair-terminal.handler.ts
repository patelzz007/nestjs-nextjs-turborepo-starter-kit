import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import { PosTerminalIdSchema, type PosPairedTerminal } from "@workspace/shared";

import { CLOCK, type Clock } from "../../../../../platform/application/clock.port";
import type { UnitOfWork } from "../../../../../platform/application/unit-of-work.port";
import { OrganizationNotActiveError, PairingCodeInvalidError } from "../../../domain/errors/pos.errors";
import type { PosScope } from "../../pos-scope";
import type { PosCredentialsPort } from "../../ports/pos-credentials.port";
import { POS_CREDENTIALS, POS_ID_GENERATOR, POS_UNIT_OF_WORK, TERMINAL_PAIRING_OPERATION, type PosIdGenerator } from "../../ports/pos.tokens";
import { PairTerminalCommand } from "./pair-terminal.command";

/** A terminal's store row is gone (stores are soft-deleted, never removed): corrupt data. */
export class TerminalStoreMissingError extends Error {
	public constructor(terminalRowId: string, locationId: string) {
		super(`Terminal ${terminalRowId} belongs to store ${locationId}, which does not exist`);
		this.name = "TerminalStoreMissingError";
	}
}

/**
 * One transaction, as the named `pos.terminal.pair` system operation (no key exists yet, so the
 * one-time code is the authorization): consume the code (single use, race-safe) → mint the till's
 * `POS` key in the name of the member who issued the code → revoke the previous key (re-pairing
 * rotates it) → bind. Unknown, expired and already-used codes all fail alike; a code of a merchant
 * that is not operating rolls back, so it survives a reactivation.
 */
@CommandHandler(PairTerminalCommand)
export class PairTerminalHandler implements ICommandHandler<PairTerminalCommand, PosPairedTerminal> {
	public constructor(
		@Inject(POS_UNIT_OF_WORK) private readonly uow: UnitOfWork<PosScope>,
		@Inject(POS_CREDENTIALS) private readonly credentials: PosCredentialsPort,
		@Inject(POS_ID_GENERATOR) private readonly ids: PosIdGenerator,
		@Inject(CLOCK) private readonly clock: Clock,
	) {}

	public async execute(command: PairTerminalCommand): Promise<PosPairedTerminal> {
		const { actor, input } = command;
		const key = this.credentials.newApiKey();
		return this.uow.runSystemOperation(TERMINAL_PAIRING_OPERATION, actor, async (scope: PosScope): Promise<PosPairedTerminal> => {
			const now = this.clock.now();
			const terminal = await scope.terminals.consumePairingCode(this.credentials.pairingCodeLookups(input.pairingCode), now);
			if (terminal === null) {
				throw new PairingCodeInvalidError();
			}
			const { organizationId, locationId, terminalId } = terminal.snapshot();
			const organization = await scope.posSettings.tillOrganization(organizationId);
			if (organization?.operating !== true) {
				throw new OrganizationNotActiveError();
			}
			const issuedByUserId = terminal.consumedCodeIssuer();
			if (issuedByUserId === null) {
				throw new PairingCodeInvalidError();
			}
			const apiKeyId = this.ids.next();
			await scope.apiKeys.add({
				id: apiKeyId,
				organizationId,
				locationId,
				name: terminal.displayName,
				keyHash: key.hash,
				keyPrefix: key.prefix,
				// A till's key may only call the POS redemption routes, never the organization API.
				scope: "POS",
				createdByUserId: issuedByUserId,
			});
			const replacedApiKeyId = terminal.pairWith(apiKeyId, now);
			const replaced = replacedApiKeyId === null ? null : await scope.apiKeys.findById(replacedApiKeyId);
			if (replaced?.revoke(now) === true) {
				await scope.apiKeys.save(replaced);
			}
			await scope.terminals.save(terminal);
			await scope.rewardAudit.append({
				organizationId,
				actorUserId: issuedByUserId,
				action: "pos.terminal_paired",
				metadata: { terminalId: terminal.id, apiKeyId, replacedApiKeyId },
			});
			const storeName = (await scope.posSettings.storeNames([locationId])).get(locationId);
			if (storeName === undefined) {
				throw new TerminalStoreMissingError(terminal.id, locationId);
			}
			return {
				apiKey: key.plaintext,
				terminalId: PosTerminalIdSchema.parse(terminalId),
				terminalName: terminal.displayName,
				organization: { slug: organization.slug, displayName: organization.displayName },
				location: { id: locationId, name: storeName },
			};
		});
	}
}

import { Inject, Injectable } from "@nestjs/common";

import { CLOCK, type Clock } from "../../../../platform/application/clock.port";
import type { MerchantApiKeyAuthContext, PairedTerminal } from "../../../../platform/application/ports/api-key-verification.port";
import type { TillResolution, TillResolverPort } from "../../../../platform/application/ports/till-resolution.port";
import type { TillTerminalsPort } from "../ports/till-terminals.port";
import { TILL_TERMINALS } from "../ports/pos.tokens";

/**
 * The security kit's `TillResolverPort`: the till a verified merchant key redeems from.
 *
 * - **Paired key** (issued by pairing): the key IS the terminal. `X-Terminal-Id` is optional; if sent it
 *   must be that terminal's id. The store is the terminal's store.
 * - **Manually created key**: `X-Terminal-Id` is required. A store-scoped key's store wins; otherwise a
 *   registered terminal's store; otherwise unknown (`null`). A store-scoped key on a terminal registered
 *   to a DIFFERENT store is refused, and with "only allow registered terminals" an unregistered id is too.
 *
 * Every call from a registered terminal updates its `lastSeenAt`.
 */
@Injectable()
export class TillAuthenticationService implements TillResolverPort {
	public constructor(
		@Inject(TILL_TERMINALS) private readonly terminals: TillTerminalsPort,
		@Inject(CLOCK) private readonly clock: Clock,
	) {}

	public async resolve(key: MerchantApiKeyAuthContext, requestedTerminalId: string | undefined): Promise<TillResolution> {
		return key.terminal === null ? this.manualKey(key, requestedTerminalId) : this.pairedKey(key, key.terminal, requestedTerminalId);
	}

	private async pairedKey(key: MerchantApiKeyAuthContext, terminal: PairedTerminal, requestedTerminalId: string | undefined): Promise<TillResolution> {
		if (requestedTerminalId !== undefined && requestedTerminalId !== terminal.terminalId) {
			return { kind: "refused", refusal: "TERMINAL_KEY_MISMATCH" };
		}
		await this.terminals.touchLastSeen(terminal.id, this.clock.now());
		return { kind: "resolved", point: { tenantId: key.tenantId, terminalId: terminal.terminalId, apiKeyId: key.apiKeyId, locationId: terminal.locationId } };
	}

	private async manualKey(key: MerchantApiKeyAuthContext, requestedTerminalId: string | undefined): Promise<TillResolution> {
		if (requestedTerminalId === undefined) {
			return { kind: "refused", refusal: "TERMINAL_ID_REQUIRED" };
		}
		const terminal = await this.terminals.findLive(key.tenantId, requestedTerminalId);
		if (terminal === null && key.requireRegisteredTerminals) {
			return { kind: "refused", refusal: "TERMINAL_NOT_REGISTERED" };
		}
		if (terminal !== null && key.locationId !== null && terminal.locationId !== key.locationId) {
			return { kind: "refused", refusal: "TERMINAL_LOCATION_MISMATCH" };
		}
		if (terminal !== null) {
			await this.terminals.touchLastSeen(terminal.id, this.clock.now());
		}
		return {
			kind: "resolved",
			point: { tenantId: key.tenantId, terminalId: requestedTerminalId, apiKeyId: key.apiKeyId, locationId: key.locationId ?? terminal?.locationId ?? null },
		};
	}
}

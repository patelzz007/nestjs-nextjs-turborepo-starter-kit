import type { EpochMs } from "@workspace/shared";

/** A one-time pairing code as stored: its keyed hash, expiry and the member who issued it. */
export interface TerminalPairingCode {
	readonly hash: string;
	readonly expiresAt: EpochMs;
	/** Null only for codes issued before issuer tracking; such a code never pairs. */
	readonly issuedByUserId: string | null;
	readonly issuedAt: EpochMs | null;
}

/** A pairing code being issued now. */
export interface IssuedPairingCode extends TerminalPairingCode {
	readonly issuedByUserId: string;
	readonly issuedAt: EpochMs;
}

/** A live terminal as a command load reads it. */
export interface OrganizationTerminalState {
	readonly id: string;
	readonly organizationId: string;
	readonly locationId: string;
	/** The id the till sends (`X-Terminal-Id`), unique among the organization's live terminals. */
	readonly terminalId: string;
	readonly label: string | null;
	readonly apiKeyId: string | null;
	readonly pairingCode: TerminalPairingCode | null;
	readonly pairedAt: EpochMs | null;
}

export interface NewTerminal {
	readonly id: string;
	readonly organizationId: string;
	readonly locationId: string;
	readonly terminalId: string;
	readonly name: string;
	readonly createdByUserId: string;
	/** The registering member issues the first code. */
	readonly pairingCode: IssuedPairingCode;
}

/** What this unit of work changed, written by the repository. */
export type TerminalChange =
	| { readonly kind: "pairing_code_issued"; readonly code: IssuedPairingCode }
	| { readonly kind: "removed"; readonly removedByUserId: string; readonly removedAt: EpochMs }
	| { readonly kind: "paired"; readonly apiKeyId: string; readonly pairedAt: EpochMs };

/**
 * A till registered at one store. It pairs by exchanging a one-time code for its own API key (a
 * re-pair rotates the key); removing it takes its key with it. A deleted terminal is never loaded.
 */
export class OrganizationTerminal {
	private change: TerminalChange | null = null;

	private constructor(
		private state: OrganizationTerminalState,
		/** Who registered it; known only for a terminal registered in this unit of work. */
		private readonly registeredByUserId: string | null,
	) {}

	public static register(terminal: NewTerminal): OrganizationTerminal {
		return new OrganizationTerminal(
			{
				id: terminal.id,
				organizationId: terminal.organizationId,
				locationId: terminal.locationId,
				terminalId: terminal.terminalId,
				label: terminal.name,
				apiKeyId: null,
				pairingCode: terminal.pairingCode,
				pairedAt: null,
			},
			terminal.createdByUserId,
		);
	}

	public static rehydrate(state: OrganizationTerminalState): OrganizationTerminal {
		return new OrganizationTerminal(state, null);
	}

	public get id(): string {
		return this.state.id;
	}

	public get locationId(): string {
		return this.state.locationId;
	}

	/** The registering member of a terminal created in this unit of work; null for a loaded one. */
	public get registrant(): string | null {
		return this.registeredByUserId;
	}

	public get pendingChange(): TerminalChange | null {
		return this.change;
	}

	/** The name the console and the till show (the terminal id when it has no label). */
	public get displayName(): string {
		return this.state.label ?? this.state.terminalId;
	}

	public snapshot(): OrganizationTerminalState {
		return this.state;
	}

	/** Replaces any live code; the till's current key keeps working until the new code is used. */
	public issuePairingCode(code: IssuedPairingCode): void {
		this.state = { ...this.state, pairingCode: code };
		this.change = { kind: "pairing_code_issued", code };
	}

	/** Soft-deletes the till (clearing its code). Returns the key to revoke with it, if it has one. */
	public remove(removedByUserId: string, removedAt: EpochMs): string | null {
		this.state = { ...this.state, pairingCode: null };
		this.change = { kind: "removed", removedByUserId, removedAt };
		return this.state.apiKeyId;
	}

	/**
	 * The member whose code the till just consumed: the new key is minted in their name. Null for a code
	 * issued before issuer tracking, which is refused rather than attributed to someone else.
	 */
	public consumedCodeIssuer(): string | null {
		return this.state.pairingCode?.issuedByUserId ?? null;
	}

	/** Binds the till's new key; returns the key it replaces (to revoke), if any. */
	public pairWith(apiKeyId: string, pairedAt: EpochMs): string | null {
		const replaced = this.state.apiKeyId;
		this.state = { ...this.state, apiKeyId, pairedAt, pairingCode: null };
		this.change = { kind: "paired", apiKeyId, pairedAt };
		return replaced;
	}
}

import type { EpochMs, OrganizationApiKeyScope } from "@workspace/shared";

/** A key's stored facts, as a command load reads it. */
export interface OrganizationApiKeyState {
	readonly id: string;
	readonly organizationId: string;
	/** The store the key is limited to; null for an organization-wide key. */
	readonly locationId: string | null;
	readonly revokedAt: EpochMs | null;
}

export interface NewApiKey {
	readonly id: string;
	readonly organizationId: string;
	readonly locationId: string | null;
	readonly name: string;
	/** sha256 of the plaintext (the plaintext is shown once and never stored). */
	readonly keyHash: string;
	readonly keyPrefix: string;
	readonly scope: OrganizationApiKeyScope;
	readonly createdByUserId: string;
}

/**
 * A merchant API key: a till's credential (scope `POS`, minted by pairing) or an integration's
 * (`INTEGRATION`, minted in the console). Revocation is final and idempotent (D34).
 */
export class OrganizationApiKey {
	private revokedNow: EpochMs | null = null;

	private constructor(private readonly state: OrganizationApiKeyState) {}

	public static rehydrate(state: OrganizationApiKeyState): OrganizationApiKey {
		return new OrganizationApiKey(state);
	}

	public get id(): string {
		return this.state.id;
	}

	public get locationId(): string | null {
		return this.state.locationId;
	}

	/** When this unit of work revoked it; null when it did not (or it already was). */
	public get revokedInThisUnitOfWork(): EpochMs | null {
		return this.revokedNow;
	}

	/** Revokes a live key; a key that is already revoked stays as it is (its original `revokedAt` is kept). */
	public revoke(now: EpochMs): boolean {
		if (this.state.revokedAt !== null || this.revokedNow !== null) {
			return false;
		}
		this.revokedNow = now;
		return true;
	}
}

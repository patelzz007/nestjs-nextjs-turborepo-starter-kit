import { Inject, Injectable } from "@nestjs/common";
import type {
	AdminMfaRecoveryListQuery,
	AdminMfaRecoveryRequest,
	BackupCodesRemainingResponse,
	MfaRecoveryStatusResponse,
	OwnProfile,
	PaginatedServiceResult,
	PasskeyList,
	Session,
	SessionListQuery,
	UserPreferences,
} from "@workspace/shared";

import type { ActorContext } from "../../../../platform/application/actor-context";
import { ProfileNotFoundError } from "../../domain/errors/identity.errors";
import type { IdentityReadPort } from "../ports/identity-read.port";
import { IDENTITY_READ } from "../ports/identity.tokens";

/** The MFA recovery status of an account that never asked for one. */
const NO_MFA_RECOVERY_REQUEST: MfaRecoveryStatusResponse = { status: "NONE", message: "No MFA recovery request found" };

/**
 * The reads of an account (ADR 096): the signed-in person's own profile, preferences, sessions, passkeys, backup codes
 * and MFA recovery, and the platform's queue of MFA recovery requests. The routes name the account from the session.
 */
@Injectable()
export class AccountApplicationService {
	public constructor(@Inject(IDENTITY_READ) private readonly reads: IdentityReadPort) {}

	public async ownProfile(actor: ActorContext, userId: string): Promise<OwnProfile> {
		const profile: OwnProfile | null = await this.reads.findOwnProfile(actor, userId);
		if (profile === null) {
			throw new ProfileNotFoundError(userId);
		}
		return profile;
	}

	public ownPreferences(actor: ActorContext, userId: string): Promise<UserPreferences> {
		return this.reads.listOwnPreferences(actor, userId);
	}

	/** One page of the account's active sessions, the current one marked. */
	public activeSessions(
		actor: ActorContext,
		input: { readonly userId: string; readonly currentSessionId: string | null; readonly query: SessionListQuery },
	): Promise<PaginatedServiceResult<Session>> {
		return this.reads.listActiveSessions(actor, input.userId, input.currentSessionId, input.query);
	}

	public async passkeys(actor: ActorContext, userId: string): Promise<PasskeyList> {
		return { passkeys: [...(await this.reads.listPasskeys(actor, userId))] };
	}

	public async remainingBackupCodes(actor: ActorContext, userId: string): Promise<BackupCodesRemainingResponse> {
		return { remaining: await this.reads.countUnusedBackupCodes(actor, userId) };
	}

	/** The account's latest MFA recovery request, or `NONE` when it never asked for one. */
	public async mfaRecoveryStatus(actor: ActorContext, userId: string): Promise<MfaRecoveryStatusResponse> {
		return (await this.reads.latestMfaRecovery(actor, userId)) ?? NO_MFA_RECOVERY_REQUEST;
	}

	/** One page of every account's MFA recovery requests, for the platform. */
	public mfaRecoveryRequests(actor: ActorContext, query: AdminMfaRecoveryListQuery): Promise<PaginatedServiceResult<AdminMfaRecoveryRequest>> {
		return this.reads.listMfaRecoveries(actor, query);
	}
}

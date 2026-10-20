import { Command } from "@nestjs/cqrs";
import type {
	LoginRestrictedEnrollmentResponse,
	LoginServiceResponse,
	LoginVerificationPendingResponse,
	TenantTeamInviteAcceptResponse,
	TenantTeamInviteRegisterAcceptInput,
} from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";
import type { SessionDeviceContext } from "../../../../identity/public-api";

/** The account the registration created, before its first sign-in. */
export interface RegisteredTeamInviteAcceptance extends TenantTeamInviteAcceptResponse {
	readonly userId: string;
	readonly email: string;
}

/** The registration request plus the sign-in it ends with. */
export interface RegisterAndAcceptTeamInviteInput {
	readonly body: TenantTeamInviteRegisterAcceptInput;
	/** The app the new account signs in to. */
	readonly clientType: string;
	readonly device: SessionDeviceContext;
}

/** What the first sign-in answered: a session, a restricted enrollment session, or a pending new-device code. */
export type TeamInviteRegistrationSignIn = LoginServiceResponse | LoginRestrictedEnrollmentResponse | LoginVerificationPendingResponse;

/** An invitee without an account creates one, accepts the team invite, and signs in, in one step. */
export class RegisterAndAcceptTeamInviteCommand extends Command<TeamInviteRegistrationSignIn> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: RegisterAndAcceptTeamInviteInput,
	) {
		super();
	}
}

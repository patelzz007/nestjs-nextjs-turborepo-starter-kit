import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";

import { CLOCK, type Clock } from "../../../../../platform/application/clock.port";
import { NotFoundError } from "../../../../../platform/application/errors/app-error";
import { ACCOUNT_PROVISIONING, type AccountProvisioningPort } from "../../../../../platform/application/ports/account-provisioning.port";
import type { UnitOfWork } from "../../../../../platform/application/unit-of-work.port";
import { REGISTRATION_SIGN_IN, type RegistrationSignInPort } from "../../../../identity/public-api";
import { InviteAccountExistsError } from "../../../domain/errors/tenants.errors";
import { assertTeamInviteNotExpired } from "../../../domain/policies/invitation-validity.policy";
import type { TenantsScope } from "../../tenants-scope";
import type { InviteTokenPort } from "../../ports/invite-tokens.port";
import { TENANT_INVITATION_REGISTER_AND_ACCEPT_OPERATION, INVITE_TOKENS, TENANTS_UNIT_OF_WORK, TEAM_READ } from "../../ports/tenants.tokens";
import type { TeamReadPort } from "../../ports/team-read.port";
import { acceptTeamInviteInScope, invalidTeamInviteLink } from "../../team-invite-acceptance";
import { RegisterAndAcceptTeamInviteCommand, type RegisteredTeamInviteAcceptance, type TeamInviteRegistrationSignIn } from "./register-and-accept-team-invite.command";

/** The app the invitee signs in to; its verify-email link points there. */
const STAFF_CLIENT_TYPE = "merchant";

/**
 * The account, its default role, the invite compare-and-set, the membership
 * and the audit row commit together or not at all (a failed accept never
 * leaves an orphan account behind). The link is checked before the password
 * is hashed, so a bad token costs no hashing. After commit the new account
 * signs in through identity (the same post-credential step as a login).
 */
@CommandHandler(RegisterAndAcceptTeamInviteCommand)
export class RegisterAndAcceptTeamInviteHandler implements ICommandHandler<RegisterAndAcceptTeamInviteCommand, TeamInviteRegistrationSignIn> {
	public constructor(
		@Inject(TENANTS_UNIT_OF_WORK) private readonly uow: UnitOfWork<TenantsScope>,
		@Inject(TEAM_READ) private readonly team: TeamReadPort,
		@Inject(ACCOUNT_PROVISIONING) private readonly accounts: AccountProvisioningPort,
		@Inject(INVITE_TOKENS) private readonly tokens: InviteTokenPort,
		@Inject(REGISTRATION_SIGN_IN) private readonly signIn: RegistrationSignInPort,
		@Inject(CLOCK) private readonly clock: Clock,
	) {}

	public async execute(command: RegisterAndAcceptTeamInviteCommand): Promise<TeamInviteRegistrationSignIn> {
		const { actor } = command;
		const input = command.input.body;
		const tokenHash = this.tokens.hash(input.token);
		const preview = await this.team.findPendingInvitePreview(tokenHash);
		if (preview === null) {
			throw invalidTeamInviteLink();
		}
		assertTeamInviteNotExpired(preview.expiresAt, this.clock.now());
		const passwordHash = await this.accounts.hashPassword(input.password);

		const accepted = await this.uow.runSystemOperation(TENANT_INVITATION_REGISTER_AND_ACCEPT_OPERATION, actor, async (scope): Promise<RegisteredTeamInviteAcceptance> => {
			const invite = await scope.invitations.findPendingTeamInviteByTokenHash(tokenHash);
			if (invite === null) {
				throw invalidTeamInviteLink();
			}
			const now = this.clock.now();
			invite.assertTeamInviteUsable(now);
			if (invite.tenantId === null) {
				throw new NotFoundError();
			}
			if ((await scope.accounts.findAccountIdByEmail(invite.email)) !== null) {
				throw new InviteAccountExistsError();
			}
			const created = await scope.accounts.createAccount({ email: invite.email, passwordHash, fullName: input.fullName });
			if (created.kind === "email_taken") {
				throw new InviteAccountExistsError();
			}
			const tenantSlug = await acceptTeamInviteInScope(scope, invite, created.userId, now);
			return { tenantSlug, message: "Invitation accepted", userId: created.userId, email: invite.email };
		});

		await this.accounts.sendVerificationEmailIfUnverified(accepted.email, STAFF_CLIENT_TYPE);
		return this.signIn.signInNewAccount(actor, { userId: accepted.userId, clientType: command.input.clientType, device: command.input.device });
	}
}

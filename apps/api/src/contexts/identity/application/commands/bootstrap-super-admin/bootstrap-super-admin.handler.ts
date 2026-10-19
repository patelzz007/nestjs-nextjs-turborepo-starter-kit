import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import type { EpochMs } from "@workspace/shared";

import { CLOCK, type Clock } from "../../../../../platform/application/clock.port";
import type { UnitOfWork } from "../../../../../platform/application/unit-of-work.port";
import { UserAccount } from "../../../domain/aggregates/user-account.aggregate";
import { BootstrapEmailTakenError, EmailAlreadyRegisteredError, SuperAdminAlreadyExistsError, SuperAdminRoleMissingError } from "../../../domain/errors/identity.errors";
import { EmailAddress } from "../../../domain/value-objects/email-address.value-object";
import type { IdentityScope } from "../../identity-scope";
import type { CredentialCryptoPort } from "../../ports/credential-crypto.port";
import type { IdGeneratorPort } from "../../ports/id-generator.port";
import { CREDENTIAL_CRYPTO, ID_GENERATOR, IDENTITY_UNIT_OF_WORK, SUPERADMIN_BOOTSTRAP_OPERATION } from "../../ports/identity.tokens";
import { OPERATOR_IDENTITY, type OperatorIdentityPort } from "../../ports/operator-identity.port";
import { BootstrapSuperAdminCommand } from "./bootstrap-super-admin.command";
import type { BootstrapOutcome } from "./bootstrap-super-admin.types";

/** Name of the platform role the first SuperAdmin is assigned. */
export const SUPER_ADMIN_ROLE_NAME = "SuperAdmin";

/** The audit action recorded besides `ROLE_ASSIGNED_AT_PROVISIONING`. */
const SUPER_ADMIN_BOOTSTRAPPED_ACTION = "SUPER_ADMIN_BOOTSTRAPPED";

/**
 * Creates the platform's FIRST SuperAdmin from the command line (deployments where the seed never
 * runs). One transaction under the allowlisted `auth.superadmin.bootstrap` operation:
 *
 * 1. a transaction-scoped advisory lock: a second concurrent run
 *    blocks until the first commits, then finds the SuperAdmin — two runs can never both succeed;
 * 2. refuse if any active SuperAdmin exists, or the email is taken (it creates, never promotes);
 * 3. create the account with a VERIFIED email (the operator proved control of the server) and an MFA
 *    enrollment deadline of NOW (the first login is restricted to 2FA enrollment);
 * 4. assign the `SuperAdmin` role with the audit rows naming the system operation and the OS user.
 *
 * The password is hashed BEFORE the transaction so the lock is never held across the slow hash.
 */
@CommandHandler(BootstrapSuperAdminCommand)
export class BootstrapSuperAdminHandler implements ICommandHandler<BootstrapSuperAdminCommand, BootstrapOutcome> {
	public constructor(
		@Inject(IDENTITY_UNIT_OF_WORK) private readonly uow: UnitOfWork<IdentityScope>,
		@Inject(CREDENTIAL_CRYPTO) private readonly crypto: CredentialCryptoPort,
		@Inject(ID_GENERATOR) private readonly ids: IdGeneratorPort,
		@Inject(OPERATOR_IDENTITY) private readonly operator: OperatorIdentityPort,
		@Inject(CLOCK) private readonly clock: Clock,
	) {}

	public async execute(command: BootstrapSuperAdminCommand): Promise<BootstrapOutcome> {
		const { actor, input } = command;
		const passwordHash: string = await this.crypto.hash(input.password);
		const email: EmailAddress = EmailAddress.of(input.identity.email);
		const detail: string = JSON.stringify({ email: email.value, ranBy: this.operator.current() });

		try {
			return await this.uow.runSystemOperation(SUPERADMIN_BOOTSTRAP_OPERATION, actor, async (scope: IdentityScope): Promise<BootstrapOutcome> => {
				await scope.accounts.lockSuperAdminBootstrap();
				if ((await scope.accounts.countActiveSuperAdmins(SUPER_ADMIN_ROLE_NAME)) > 0) {
					throw new SuperAdminAlreadyExistsError();
				}
				if (await scope.accounts.existsByEmail(email)) {
					throw new BootstrapEmailTakenError();
				}
				const now: EpochMs = this.clock.now();
				const account: UserAccount = UserAccount.register(
					{ id: this.ids.next(), email, fullName: input.identity.fullName, passwordHash, isSuperAdmin: true, emailVerifiedAt: now, mfaEnrollmentDeadline: now },
					now,
				);
				await scope.accounts.add(account);
				await scope.signupReferrals.issueFirstCode(account.id, now);
				const assigned = await scope.roles.assignPlatformRole({
					userId: account.id,
					roleName: SUPER_ADMIN_ROLE_NAME,
					operation: SUPERADMIN_BOOTSTRAP_OPERATION,
					detail,
					precedingAuditActions: [SUPER_ADMIN_BOOTSTRAPPED_ACTION],
				});
				if (assigned.kind === "role_missing") {
					throw new SuperAdminRoleMissingError(SUPER_ADMIN_ROLE_NAME);
				}
				return { userId: account.id, email: email.value, fullName: account.fullName };
			});
		} catch (error) {
			if (error instanceof EmailAlreadyRegisteredError) {
				throw new BootstrapEmailTakenError();
			}
			throw error;
		}
	}
}

import { Inject, Injectable } from "@nestjs/common";
import type { EpochMs } from "@workspace/shared";

import type { ActorContext } from "../../../../platform/application/actor-context";
import { CLOCK, type Clock } from "../../../../platform/application/clock.port";
import type { AccountProvisioningPort, OnboardingAccountCredentials } from "../../../../platform/application/ports/account-provisioning.port";
import type { UnitOfWork } from "../../../../platform/application/unit-of-work.port";
import { ACCOUNT_DEFAULT_ROLE, type AccountDefaultRolePort } from "../../../authorization/public-api";
import { UserAccount } from "../../domain/aggregates/user-account.aggregate";
import { EmailAlreadyRegisteredError } from "../../domain/errors/identity.errors";
import { EmailAddress } from "../../domain/value-objects/email-address.value-object";
import type { IdentityScope } from "../identity-scope";
import type { CredentialCryptoPort } from "../ports/credential-crypto.port";
import type { IdGeneratorPort } from "../ports/id-generator.port";
import type { IdentityTokensPort } from "../ports/identity-tokens.port";
import { CREDENTIAL_CRYPTO, ID_GENERATOR, IDENTITY_TOKENS, IDENTITY_UNIT_OF_WORK, PUBLIC_AUTH_FLOW_OPERATION } from "../ports/identity.tokens";
import { backgroundActorOf } from "./background-actor";

/**
 * `AccountProvisioningPort` (exposed to organizations: invite registration, merchant onboarding). Each
 * call is its own unit of work under the public flow's bypass operation; the account's own audited
 * role assignment goes through authorization's port.
 */
@Injectable()
export class AccountProvisioningService implements AccountProvisioningPort {
	public constructor(
		@Inject(IDENTITY_UNIT_OF_WORK) private readonly uow: UnitOfWork<IdentityScope>,
		@Inject(CREDENTIAL_CRYPTO) private readonly crypto: CredentialCryptoPort,
		@Inject(IDENTITY_TOKENS) private readonly tokens: IdentityTokensPort,
		@Inject(ID_GENERATOR) private readonly ids: IdGeneratorPort,
		@Inject(ACCOUNT_DEFAULT_ROLE) private readonly roles: AccountDefaultRolePort,
		@Inject(CLOCK) private readonly clock: Clock,
	) {}

	public hashPassword(password: string): Promise<string> {
		return this.crypto.hash(password);
	}

	public async resolveOnboardingAccount(credentials: OnboardingAccountCredentials): Promise<string> {
		const actor: ActorContext = backgroundActorOf();
		const email: EmailAddress = EmailAddress.of(credentials.email);
		const existing: UserAccount | null = await this.uow.runSystemOperation(PUBLIC_AUTH_FLOW_OPERATION, actor, (scope) => scope.accounts.findByEmail(email));
		if (existing === null) {
			const passwordHash: string = await this.crypto.hash(credentials.password);
			try {
				return await this.uow.runSystemOperation(PUBLIC_AUTH_FLOW_OPERATION, actor, async (scope: IdentityScope): Promise<string> => {
					const now: EpochMs = this.clock.now();
					const account: UserAccount = UserAccount.register(
						{ id: this.ids.next(), email, fullName: credentials.fullName, passwordHash, isSuperAdmin: false, emailVerifiedAt: null, mfaEnrollmentDeadline: null },
						now,
					);
					await scope.accounts.add(account);
					await scope.signupReferrals.issueFirstCode(account.id, now);
					await scope.roles.assignDefaultRole(account.id);
					return account.id;
				});
			} catch (error) {
				// A concurrent completion created the account first: continue as the existing-account path.
				if (error instanceof EmailAlreadyRegisteredError) {
					return this.resolveOnboardingAccount(credentials);
				}
				throw error;
			}
		}

		existing.assertProvisioningPassword(await this.crypto.compare(credentials.password, existing.passwordHash));
		await this.roles.ensureDefaultRole(existing.id);
		existing.rename(credentials.fullName, this.clock.now());
		if (existing.pendingChanges.length > 0) {
			await this.uow.runSystemOperation(PUBLIC_AUTH_FLOW_OPERATION, actor, async (scope: IdentityScope): Promise<void> => {
				await scope.accounts.save(existing);
				scope.events.collectFrom(existing);
			});
		}
		return existing.id;
	}

	public accountExists(email: string): Promise<boolean> {
		const address: EmailAddress = EmailAddress.of(email);
		return this.uow.runSystemOperation(PUBLIC_AUTH_FLOW_OPERATION, backgroundActorOf(), (scope: IdentityScope): Promise<boolean> => scope.accounts.existsByEmail(address));
	}

	public async sendVerificationEmailIfUnverified(email: string, clientType: string): Promise<void> {
		const address: EmailAddress = EmailAddress.of(email);
		await this.uow.runSystemOperation(PUBLIC_AUTH_FLOW_OPERATION, backgroundActorOf(), async (scope: IdentityScope): Promise<void> => {
			const account: UserAccount | null = await scope.accounts.findByEmail(address);
			if (account?.awaitsEmailVerification() !== true) {
				return;
			}
			await scope.emails.sendVerificationEmail(address.value, await this.tokens.generateEmailVerificationToken(address.value), clientType);
		});
	}
}

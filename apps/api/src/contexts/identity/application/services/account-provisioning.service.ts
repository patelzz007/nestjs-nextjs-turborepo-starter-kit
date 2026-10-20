import { Inject, Injectable } from "@nestjs/common";

import type { AccountProvisioningPort, OnboardingAccountCredentials, OnboardingAccountPlan } from "../../../../platform/application/ports/account-provisioning.port";
import type { UnitOfWork } from "../../../../platform/application/unit-of-work.port";
import { ACCOUNT_DEFAULT_ROLE, type AccountDefaultRolePort } from "../../../authorization/public-api";
import { UserAccount } from "../../domain/aggregates/user-account.aggregate";
import { EmailAddress } from "../../domain/value-objects/email-address.value-object";
import type { IdentityScope } from "../identity-scope";
import type { CredentialCryptoPort } from "../ports/credential-crypto.port";
import type { IdentityTokensPort } from "../ports/identity-tokens.port";
import { CREDENTIAL_CRYPTO, IDENTITY_TOKENS, IDENTITY_UNIT_OF_WORK, ACCOUNT_LOOKUP_OPERATION, EMAIL_VERIFICATION_SEND_OPERATION } from "../ports/identity.tokens";
import { backgroundActorOf } from "./background-actor";

/**
 * `AccountProvisioningPort` (exposed to tenants: invite registration, merchant onboarding). Each
 * call is its own unit of work under a named operation; the account's own audited role assignment
 * for an existing account goes through authorization's port.
 */
@Injectable()
export class AccountProvisioningService implements AccountProvisioningPort {
	public constructor(
		@Inject(IDENTITY_UNIT_OF_WORK) private readonly uow: UnitOfWork<IdentityScope>,
		@Inject(CREDENTIAL_CRYPTO) private readonly crypto: CredentialCryptoPort,
		@Inject(IDENTITY_TOKENS) private readonly tokens: IdentityTokensPort,
		@Inject(ACCOUNT_DEFAULT_ROLE) private readonly roles: AccountDefaultRolePort,
	) {}

	public hashPassword(password: string): Promise<string> {
		return this.crypto.hash(password);
	}

	public async checkOnboardingCredentials(credentials: Pick<OnboardingAccountCredentials, "email" | "password">): Promise<OnboardingAccountPlan> {
		const email: EmailAddress = EmailAddress.of(credentials.email);
		const existing: UserAccount | null = await this.uow.runSystemOperation(ACCOUNT_LOOKUP_OPERATION, backgroundActorOf(), (scope) => scope.accounts.findByEmail(email));
		if (existing === null) {
			return { kind: "new", passwordHash: await this.crypto.hash(credentials.password) };
		}
		existing.assertProvisioningPassword(await this.crypto.compare(credentials.password, existing.passwordHash));
		return { kind: "existing", userId: existing.id };
	}

	public ensureDefaultRole(userId: string): Promise<void> {
		return this.roles.ensureDefaultRole(userId);
	}

	public accountExists(email: string): Promise<boolean> {
		const address: EmailAddress = EmailAddress.of(email);
		return this.uow.runSystemOperation(ACCOUNT_LOOKUP_OPERATION, backgroundActorOf(), (scope: IdentityScope): Promise<boolean> => scope.accounts.existsByEmail(address));
	}

	public async sendVerificationEmailIfUnverified(email: string, clientType: string): Promise<void> {
		const address: EmailAddress = EmailAddress.of(email);
		await this.uow.runSystemOperation(EMAIL_VERIFICATION_SEND_OPERATION, backgroundActorOf(), async (scope: IdentityScope): Promise<void> => {
			const account: UserAccount | null = await scope.accounts.findByEmail(address);
			if (account?.awaitsEmailVerification() !== true) {
				return;
			}
			await scope.emails.sendVerificationEmail(address.value, await this.tokens.generateEmailVerificationToken(address.value), clientType);
		});
	}
}

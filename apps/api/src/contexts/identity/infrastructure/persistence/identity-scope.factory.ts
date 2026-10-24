import type { Prisma } from "@prisma/client";

import type { PublicUrlResolve } from "../../../../config/public-url.resolver";
import type { TypedConfigService } from "../../../../config/typed-config.service";
import type { ScopeFactory } from "../../../../platform/application/events/in-transaction-event-handler";
import type { TransactionalEventCollector } from "../../../../platform/application/events/transactional-event-collector";
import type { AuditTrailService } from "../../../../platform/infrastructure/audit/audit-trail.service";
import type { NotificationsTransactionalPortsFactory } from "../../../notifications/public-api";
import { createAuthorizationTransactionalPorts } from "../../../authorization/public-api";
import { createReferralsTransactionalPorts } from "../../../referrals/public-api";
import type { IdentityScope } from "../../application/identity-scope";
import { IdentityEmailAdapter } from "../adapters/identity-email.adapter";
import { TransactionalRequestAudit } from "../adapters/request-audit.adapter";
import { PrismaDeviceSessionRepository } from "./prisma-device-session.repository";
import { PrismaImpersonationSessionRepository } from "./prisma-impersonation-session.repository";
import { PrismaMfaRecoveryRequestRepository } from "./prisma-mfa-recovery-request.repository";
import { PrismaPasswordResetTokenRepository } from "./prisma-password-reset-token.repository";
import { PrismaTwoFactorEnrollmentRepository, PrismaTwoFactorLoginChallengeRepository } from "./prisma-two-factor.repository";
import { PrismaUserAccountRepository } from "./prisma-user-account.repository";
import { PrismaUserPreferenceRepository } from "./prisma-user-preference.repository";
import { PrismaUserProfileRepository } from "./prisma-user-profile.repository";

/** What the scope factory is built from (module singletons; none holds a transaction). */
export interface IdentityScopeDependencies {
	/** Notifications' transactional email request, bound per unit of work (only `create` is used). */
	readonly notifications: Pick<NotificationsTransactionalPortsFactory, "create">;
	readonly auditTrail: AuditTrailService;
	readonly config: TypedConfigService;
	readonly resolvePublicUrl: PublicUrlResolve;
}

/**
 * Builds identity's repositories and cross-context ports bound to ONE unit-of-work transaction: new
 * instances on every call, never cached, `db` never stored on a singleton (§5.4). Emails go through
 * notifications' transactional request (ADR 060): the email log and outbox rows commit with the change.
 */
export class IdentityScopeFactory implements ScopeFactory<IdentityScope, Prisma.TransactionClient> {
	public constructor(private readonly dependencies: IdentityScopeDependencies) {}

	public create(db: Prisma.TransactionClient, events: TransactionalEventCollector): IdentityScope {
		const { notifications, auditTrail, config, resolvePublicUrl } = this.dependencies;
		return {
			accounts: new PrismaUserAccountRepository(db),
			resetTokens: new PrismaPasswordResetTokenRepository(db),
			twoFactor: new PrismaTwoFactorEnrollmentRepository(db),
			challenges: new PrismaTwoFactorLoginChallengeRepository(db),
			mfaRecoveries: new PrismaMfaRecoveryRequestRepository(db),
			sessions: new PrismaDeviceSessionRepository(db),
			impersonations: new PrismaImpersonationSessionRepository(db),
			profiles: new PrismaUserProfileRepository(db, resolvePublicUrl),
			preferences: new PrismaUserPreferenceRepository(db),
			signupReferrals: createReferralsTransactionalPorts(db).signupReferrals,
			roles: createAuthorizationTransactionalPorts(db).defaultRoleAssignment,
			emails: new IdentityEmailAdapter(() => notifications.create(db, events).emailRequests, config),
			requestAudit: new TransactionalRequestAudit(auditTrail, db),
			events,
		};
	}
}

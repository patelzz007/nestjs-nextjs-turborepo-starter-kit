import { Global, Logger, Module, type OnModuleInit } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import type { Prisma } from "@prisma/client";
import type Redis from "ioredis";

import { PublicUrlResolver } from "../../config/public-url.resolver";
import { TypedConfigService } from "../../config/typed-config.service";
import { IntegrationEventMapperRegistry } from "../../platform/application/events/integration-event-mapper";
import { ACCOUNT_PROVISIONING } from "../../platform/application/ports/account-provisioning.port";
import { ACCESS_TOKEN_STATE, ACCESS_TOKEN_VERIFIER, AUTH_FLOW_RECORDER, IMPERSONATION_TOKEN_CHECK } from "../../platform/application/ports/access-token.port";
import { IDENTITY_SESSIONS, type IdentitySessionsPort, type IdentitySessionsPortFactory } from "../../platform/application/ports/identity-sessions.port";
import type { UnitOfWork } from "../../platform/application/unit-of-work.port";
import { AuditTrailService } from "../../platform/infrastructure/audit/audit-trail.service";
import { OutboxModule } from "../../platform/infrastructure/outbox/outbox.module";
import { REDIS_PUBLISHER } from "../../platform/infrastructure/redis/redis.tokens";
import { SystemCommandModule } from "../../platform/infrastructure/system-command.module";
import type { AfterCommitPublisher } from "../../platform/infrastructure/unit-of-work/after-commit-publisher";
import { PrismaUnitOfWork } from "../../platform/infrastructure/unit-of-work/prisma-unit-of-work";
import { USER_OWNED_DATA_SCOPE } from "../../platform/infrastructure/unit-of-work/actor-to-rls-context";
import { TransactionalEventDispatcher } from "../../platform/infrastructure/unit-of-work/transactional-event-dispatcher";
import { AFTER_COMMIT_PUBLISHER, UnitOfWorkModule } from "../../platform/infrastructure/unit-of-work/unit-of-work.module";
import { PrismaModule } from "../../prisma/prisma.module";
import { TenantTransactionService } from "../../prisma/tenant-transaction.service";
import { PrismaImpersonationTenantFacts } from "./infrastructure/adapters/prisma-impersonation-tenant-facts";
import { FilesModule } from "../files/public-api";
import { NotificationsModule, NotificationsTransactionalPortsFactory } from "../notifications/public-api";
import { TenantAccessModule } from "../tenancy/public-api";
import { REFEREE_ATTRIBUTION_FACTORY, ReferralsModule } from "../referrals/public-api";
import { IDENTITY_REFEREE_ATTRIBUTION_FACTORY } from "./infrastructure/adapters/referee-attribution.adapter";
import type { IdentityScope } from "./application/identity-scope";
import {
	ACCESS_TOKEN_INVALIDATION,
	AUTH_FLOW_SUBJECT,
	AUTHENTICATOR,
	CREDENTIAL_CRYPTO,
	ID_GENERATOR,
	IMPERSONATION_TENANT_FACTS,
	IDENTITY_READ,
	IDENTITY_SETTINGS,
	IDENTITY_TELEMETRY,
	IDENTITY_TOKENS,
	IDENTITY_UNIT_OF_WORK,
	LOGIN_VERIFICATION_STORE,
	REGISTRATION_SIGN_IN,
	SESSION_LOCATION_LOOKUP,
	TOTP_SECRET_CIPHER,
	USER_SESSION_CACHE,
	AUTHORIZATION_CHANGE_FEED,
} from "./application/ports/identity.tokens";
import { OPERATOR_IDENTITY } from "./application/ports/operator-identity.port";
import { AccountProvisioningService } from "./application/services/account-provisioning.service";
import { LoginVerificationGate } from "./application/services/login-verification.gate";
import { MfaLoginCompletion } from "./application/services/mfa-login-completion";
import { RegistrationSignInApplicationService } from "./application/services/registration-sign-in.application-service";
import { SessionIssuer } from "./application/services/session-issuer";
import { BootstrapSuperAdminHandler } from "./application/commands/bootstrap-super-admin/bootstrap-super-admin.handler";
import { ChangePasswordHandler } from "./application/commands/change-password/change-password.handler";
import { CompleteBackupCodeLoginHandler } from "./application/commands/complete-backup-code-login/complete-backup-code-login.handler";
import { CompleteDueMfaRecoveriesHandler } from "./application/commands/complete-due-mfa-recoveries/complete-due-mfa-recoveries.handler";
import { CompleteTotpLoginHandler } from "./application/commands/complete-totp-login/complete-totp-login.handler";
import { EnableTwoFactorHandler } from "./application/commands/enable-two-factor/enable-two-factor.handler";
import { LogInHandler } from "./application/commands/log-in/log-in.handler";
import { LogOutAllDevicesHandler } from "./application/commands/log-out-all-devices/log-out-all-devices.handler";
import { LogOutDeviceHandler } from "./application/commands/log-out-device/log-out-device.handler";
import { PurgeStalePasswordResetTokensHandler } from "./application/commands/purge-stale-password-reset-tokens/purge-stale-password-reset-tokens.handler";
import { RefreshSessionHandler } from "./application/commands/refresh-session/refresh-session.handler";
import { RequestMfaRecoveryHandler } from "./application/commands/request-mfa-recovery/request-mfa-recovery.handler";
import { RequestPasswordResetHandler } from "./application/commands/request-password-reset/request-password-reset.handler";
import { ResendVerificationEmailHandler } from "./application/commands/resend-verification-email/resend-verification-email.handler";
import { ResetPasswordHandler } from "./application/commands/reset-password/reset-password.handler";
import { ReviewMfaRecoveryHandler } from "./application/commands/review-mfa-recovery/review-mfa-recovery.handler";
import { RevokeMySessionHandler } from "./application/commands/revoke-my-session/revoke-my-session.handler";
import { RotateTwoFactorHandler } from "./application/commands/rotate-two-factor/rotate-two-factor.handler";
import { SignUpHandler } from "./application/commands/sign-up/sign-up.handler";
import { StartImpersonationHandler } from "./application/commands/start-impersonation/start-impersonation.handler";
import { StartTwoFactorSetupHandler } from "./application/commands/start-two-factor-setup/start-two-factor-setup.handler";
import { StopImpersonationHandler } from "./application/commands/stop-impersonation/stop-impersonation.handler";
import { UnlockAccountHandler } from "./application/commands/unlock-account/unlock-account.handler";
import { BanUserHandler } from "./application/commands/ban-user/ban-user.handler";
import { UnbanUserHandler } from "./application/commands/unban-user/unban-user.handler";
import { UpdateOwnProfileHandler } from "./application/commands/update-own-profile/update-own-profile.handler";
import { VerifyEmailHandler } from "./application/commands/verify-email/verify-email.handler";
import { VerifyNewDeviceLoginHandler } from "./application/commands/verify-new-device-login/verify-new-device-login.handler";
import { CheckBackupCodeHandler } from "./application/queries/check-backup-code/check-backup-code.handler";
import { CheckPasswordResetTokenHandler } from "./application/queries/check-password-reset-token/check-password-reset-token.handler";
import { CountRemainingBackupCodesHandler } from "./application/queries/count-remaining-backup-codes/count-remaining-backup-codes.handler";
import { GetMeHandler } from "./application/queries/get-me/get-me.handler";
import { GetMyMfaRecoveryStatusHandler } from "./application/queries/get-my-mfa-recovery-status/get-my-mfa-recovery-status.handler";
import { GetOwnProfileHandler } from "./application/queries/get-own-profile/get-own-profile.handler";
import { GetSessionPermissionsHandler } from "./application/queries/get-session-permissions/get-session-permissions.handler";
import { GetUserForAdminHandler } from "./application/queries/get-user-for-admin/get-user-for-admin.handler";
import { ListMfaRecoveryRequestsHandler } from "./application/queries/list-mfa-recovery-requests/list-mfa-recovery-requests.handler";
import { ListMySessionsHandler } from "./application/queries/list-my-sessions/list-my-sessions.handler";
import { ListUsersForAdminHandler } from "./application/queries/list-users-for-admin/list-users-for-admin.handler";
import { InvalidateAccessTokenStateHandler } from "./application/event-handlers/after-commit/invalidate-access-token-state.event-handler";
import { InvalidateMeCacheOnAuthorizationChanged } from "./application/event-handlers/after-commit/invalidate-me-cache-on-authorization-changed.event-handler";
import { InvalidateMeCacheOnProfileChangedHandler } from "./application/event-handlers/after-commit/invalidate-me-cache-on-profile-changed.event-handler";
import { AccessTokenInvalidationAdapter } from "./infrastructure/adapters/access-token-invalidation.adapter";
import { OutboxAuthFlowRecorder, TrackedAuthFlowSubject } from "./infrastructure/adapters/auth-flow.adapters";
import { identitySettingsFrom } from "./infrastructure/adapters/identity-settings.provider";
import { ImpersonationTokenCheck } from "./infrastructure/adapters/impersonation-token.check";
import { LoginVerificationStore } from "./infrastructure/adapters/login-verification.store";
import { NodeOperatorIdentity } from "./infrastructure/adapters/operator-identity.adapter";
import { OutboxIdentityTelemetry } from "./infrastructure/adapters/outbox-identity-telemetry";
import { UuidIdGenerator } from "./infrastructure/adapters/uuid-id-generator";
import { RedisUserSessionCacheService } from "./infrastructure/cache/redis-user-session-cache.service";
import { UserSessionCacheService } from "./infrastructure/cache/user-session-cache.service";
import { IdentityIntegrationEventsMapper } from "./infrastructure/outbox/identity-integration-events.mapper";
import { IdentityFileRegistrations } from "./infrastructure/persistence/identity-file-registrations";
import { IdentityScopeFactory } from "./infrastructure/persistence/identity-scope.factory";
import { createIdentityTransactionalPorts } from "./infrastructure/persistence/identity-transactional-ports";
import { PrismaIdentityReadRepository } from "./infrastructure/persistence/prisma-identity.read-repository";
import { AccessTokenStateService } from "./infrastructure/security/access-token-state.service";
import { CryptoService } from "./infrastructure/security/crypto.service";
import { OtpAuthenticator } from "./infrastructure/security/otp-authenticator";
import { SecretEncryptionService } from "./infrastructure/security/secret-encryption.service";
import { TokenService } from "./infrastructure/security/token.service";
import { SessionLocationLookupService } from "./infrastructure/session-location/session-location-lookup.service";
import { SessionLocationModule } from "./infrastructure/session-location/session-location.module";
import { AuthController } from "./presentation/http/auth.controller";
import { ImpersonationController } from "./presentation/http/impersonation.controller";
import { MfaRecoveryController } from "./presentation/http/mfa-recovery.controller";
import { ProfileController } from "./presentation/http/profile.controller";
import { SessionStatusController } from "./presentation/http/session-status.controller";
import { SessionsController } from "./presentation/http/sessions.controller";
import { TwoFactorController } from "./presentation/http/two-factor.controller";
import { IdentityMaintenanceCron } from "./presentation/jobs/identity-maintenance.cron";
import { AuthorizationChangeSweepScheduler } from "./presentation/jobs/authorization-change-sweep.scheduler";
import { AuthorizationChangeSweep } from "./application/services/authorization-change-sweep";
import { PrismaAuthorizationChangeFeedReadRepository } from "./infrastructure/persistence/prisma-authorization-change-feed.read-repository";

/** Every command, query and after-commit handler of the identity context. */
const HANDLERS = [
	BootstrapSuperAdminHandler,
	ChangePasswordHandler,
	CompleteBackupCodeLoginHandler,
	CompleteDueMfaRecoveriesHandler,
	CompleteTotpLoginHandler,
	EnableTwoFactorHandler,
	LogInHandler,
	LogOutAllDevicesHandler,
	LogOutDeviceHandler,
	PurgeStalePasswordResetTokensHandler,
	RefreshSessionHandler,
	RequestMfaRecoveryHandler,
	RequestPasswordResetHandler,
	ResendVerificationEmailHandler,
	ResetPasswordHandler,
	ReviewMfaRecoveryHandler,
	RevokeMySessionHandler,
	RotateTwoFactorHandler,
	SignUpHandler,
	StartImpersonationHandler,
	StartTwoFactorSetupHandler,
	StopImpersonationHandler,
	UnlockAccountHandler,
	BanUserHandler,
	UnbanUserHandler,
	UpdateOwnProfileHandler,
	VerifyEmailHandler,
	VerifyNewDeviceLoginHandler,
	CheckBackupCodeHandler,
	CheckPasswordResetTokenHandler,
	CountRemainingBackupCodesHandler,
	GetMeHandler,
	GetMyMfaRecoveryStatusHandler,
	GetOwnProfileHandler,
	GetSessionPermissionsHandler,
	GetUserForAdminHandler,
	ListMfaRecoveryRequestsHandler,
	ListMySessionsHandler,
	ListUsersForAdminHandler,
	InvalidateAccessTokenStateHandler,
	InvalidateMeCacheOnAuthorizationChanged,
	InvalidateMeCacheOnProfileChangedHandler,
];

/** The in-memory session cache, always built; the Redis one replaces it when configured. */
const IN_MEMORY_USER_SESSION_CACHE = Symbol("IN_MEMORY_USER_SESSION_CACHE");
const REDIS_USER_SESSION_CACHE = Symbol("REDIS_USER_SESSION_CACHE");

/**
 * The identity context's composition root (§6.1): accounts, credentials, MFA, device sessions,
 * impersonation and the own profile.
 *
 * Global, like authorization: identity owns the security kit's ports (`ACCESS_TOKEN_*`,
 * `IMPERSONATION_TOKEN_CHECK`, `AUTH_FLOW_RECORDER`), which the app-wide guards inject, and the ports
 * other contexts consume (`ACCOUNT_PROVISIONING`, `IDENTITY_SESSIONS`). Mounted by `AppModule` only and
 * not re-exported from `public-api.ts`, so importing identity's tokens never drags this module's graph
 * in (no module cycle, no `forwardRef`).
 */
@Global()
@Module({
	imports: [
		PrismaModule,
		OutboxModule,
		UnitOfWorkModule,
		SystemCommandModule,
		JwtModule.register({ global: true }),
		NotificationsModule,
		FilesModule,
		TenantAccessModule,
		ReferralsModule,
		SessionLocationModule,
	],
	controllers: [AuthController, TwoFactorController, MfaRecoveryController, ProfileController, SessionsController, SessionStatusController, ImpersonationController],
	providers: [
		// Referrals' share-link attribution writer (identity owns `User`); global, so referrals imports no context.
		{ provide: REFEREE_ATTRIBUTION_FACTORY, useValue: IDENTITY_REFEREE_ATTRIBUTION_FACTORY },
		PublicUrlResolver,
		PrismaImpersonationTenantFacts,
		{ provide: IMPERSONATION_TENANT_FACTS, useExisting: PrismaImpersonationTenantFacts },
		// ── Unit of work and reads ──────────────────────────────────────
		{
			provide: IDENTITY_UNIT_OF_WORK,
			inject: [
				TenantTransactionService,
				NotificationsTransactionalPortsFactory,
				AuditTrailService,
				TypedConfigService,
				PublicUrlResolver,
				TransactionalEventDispatcher,
				AFTER_COMMIT_PUBLISHER,
			],
			useFactory: (
				transactions: TenantTransactionService,
				notifications: NotificationsTransactionalPortsFactory,
				auditTrail: AuditTrailService,
				config: TypedConfigService,
				publicUrls: PublicUrlResolver,
				dispatcher: TransactionalEventDispatcher<Prisma.TransactionClient>,
				publisher: AfterCommitPublisher,
			): UnitOfWork<IdentityScope> =>
				// Identity's rows are the user's own (scoped by user id): no tenant is needed to change them.
				new PrismaUnitOfWork(
					transactions,
					new IdentityScopeFactory({ notifications, auditTrail, config, resolvePublicUrl: publicUrls.resolve }),
					dispatcher,
					publisher,
					USER_OWNED_DATA_SCOPE,
				),
		},
		PrismaIdentityReadRepository,
		{ provide: IDENTITY_READ, useExisting: PrismaIdentityReadRepository },
		// ── Credentials, tokens and second factors ──────────────────────
		CryptoService,
		{ provide: CREDENTIAL_CRYPTO, useExisting: CryptoService },
		TokenService,
		{ provide: IDENTITY_TOKENS, useExisting: TokenService },
		{ provide: ACCESS_TOKEN_VERIFIER, useExisting: TokenService },
		OtpAuthenticator,
		{ provide: AUTHENTICATOR, useExisting: OtpAuthenticator },
		SecretEncryptionService,
		{ provide: TOTP_SECRET_CIPHER, useExisting: SecretEncryptionService },
		UuidIdGenerator,
		{ provide: ID_GENERATOR, useExisting: UuidIdGenerator },
		{ provide: OPERATOR_IDENTITY, useClass: NodeOperatorIdentity },
		{ provide: IDENTITY_SETTINGS, inject: [TypedConfigService], useFactory: identitySettingsFrom },
		// ── Session state, caches and the login-verification store ──────
		AccessTokenStateService,
		{ provide: ACCESS_TOKEN_STATE, useExisting: AccessTokenStateService },
		ImpersonationTokenCheck,
		{ provide: IMPERSONATION_TOKEN_CHECK, useExisting: ImpersonationTokenCheck },
		LoginVerificationStore,
		{ provide: LOGIN_VERIFICATION_STORE, useExisting: LoginVerificationStore },
		{ provide: SESSION_LOCATION_LOOKUP, useExisting: SessionLocationLookupService },
		UserSessionCacheService,
		{ provide: IN_MEMORY_USER_SESSION_CACHE, useExisting: UserSessionCacheService },
		{
			// Uses the SHARED publisher client: its connection and shutdown belong to the messaging RedisInfrastructureModule, never to this cache.
			provide: REDIS_USER_SESSION_CACHE,
			inject: [TypedConfigService, REDIS_PUBLISHER],
			useFactory: (config: TypedConfigService, publisher: Redis | null): RedisUserSessionCacheService | null => {
				if (!config.useRedisUserSessionCache) {
					if (config.caches.userSessionBackend === "redis" && config.messaging.redisUrl === undefined) {
						Logger.warn("USER_SESSION_CACHE_BACKEND=redis but REDIS_URL is unset — using in-memory user session cache", IdentityModule.name);
					}
					return null;
				}
				return publisher === null ? null : new RedisUserSessionCacheService(config, publisher);
			},
		},
		{
			provide: USER_SESSION_CACHE,
			inject: [IN_MEMORY_USER_SESSION_CACHE, REDIS_USER_SESSION_CACHE],
			useFactory: (memory: UserSessionCacheService, redis: RedisUserSessionCacheService | null): UserSessionCacheService => redis ?? memory,
		},
		AccessTokenInvalidationAdapter,
		{ provide: ACCESS_TOKEN_INVALIDATION, useExisting: AccessTokenInvalidationAdapter },
		// ── Telemetry ───────────────────────────────────────────────────
		OutboxAuthFlowRecorder,
		{ provide: AUTH_FLOW_RECORDER, useExisting: OutboxAuthFlowRecorder },
		TrackedAuthFlowSubject,
		{ provide: AUTH_FLOW_SUBJECT, useExisting: TrackedAuthFlowSubject },
		OutboxIdentityTelemetry,
		{ provide: IDENTITY_TELEMETRY, useExisting: OutboxIdentityTelemetry },
		// ── Application services ────────────────────────────────────────
		SessionIssuer,
		LoginVerificationGate,
		MfaLoginCompletion,
		AccountProvisioningService,
		{ provide: ACCOUNT_PROVISIONING, useExisting: AccountProvisioningService },
		RegistrationSignInApplicationService,
		{ provide: REGISTRATION_SIGN_IN, useExisting: RegistrationSignInApplicationService },
		// ── Ports other contexts bind to their own transaction ──────────
		{
			provide: IDENTITY_SESSIONS,
			inject: [ID_GENERATOR],
			useFactory: (ids: UuidIdGenerator): IdentitySessionsPortFactory<Prisma.TransactionClient> => ({
				forTransaction: (db: Prisma.TransactionClient): IdentitySessionsPort => createIdentityTransactionalPorts(db, { newId: (): string => ids.next() }, null).sessions,
			}),
		},
		// ── Files and jobs ──────────────────────────────────────────────
		IdentityFileRegistrations,
		IdentityMaintenanceCron,
		{
			provide: AUTHORIZATION_CHANGE_FEED,
			inject: [TenantTransactionService],
			useFactory: (transactions: TenantTransactionService): PrismaAuthorizationChangeFeedReadRepository => new PrismaAuthorizationChangeFeedReadRepository(transactions),
		},
		AuthorizationChangeSweep,
		AuthorizationChangeSweepScheduler,
		...HANDLERS,
	],
	exports: [
		ACCESS_TOKEN_VERIFIER,
		ACCESS_TOKEN_STATE,
		IMPERSONATION_TOKEN_CHECK,
		AUTH_FLOW_RECORDER,
		ACCOUNT_PROVISIONING,
		REGISTRATION_SIGN_IN,
		IDENTITY_SESSIONS,
		REFEREE_ATTRIBUTION_FACTORY,
	],
})
export class IdentityModule implements OnModuleInit {
	public constructor(private readonly mappers: IntegrationEventMapperRegistry) {}

	/** Registers the `session.action` / `impersonation.action` outbox mapper (M3). */
	public onModuleInit(): void {
		this.mappers.register(new IdentityIntegrationEventsMapper());
	}
}

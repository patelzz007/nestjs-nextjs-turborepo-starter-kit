import { Inject, Module, type OnModuleInit } from "@nestjs/common";
import type { Prisma } from "@prisma/client";

import { TypedConfigService } from "../../config/typed-config.service";
import { bindInTransactionHandler } from "../../platform/application/events/in-transaction-event-handler";
import { InTransactionEventRegistry } from "../../platform/application/events/in-transaction-event-registry";
import type { UnitOfWork } from "../../platform/application/unit-of-work.port";
import { LogService } from "../../platform/infrastructure/logging/logs.service";
import { SystemCommandModule } from "../../platform/infrastructure/system-command.module";
import type { AfterCommitPublisher } from "../../platform/infrastructure/unit-of-work/after-commit-publisher";
import { PrismaReadExecutor } from "../../platform/infrastructure/unit-of-work/prisma-read-executor";
import { PrismaUnitOfWork } from "../../platform/infrastructure/unit-of-work/prisma-unit-of-work";
import { TransactionalEventDispatcher } from "../../platform/infrastructure/unit-of-work/transactional-event-dispatcher";
import { AFTER_COMMIT_PUBLISHER, UnitOfWorkModule } from "../../platform/infrastructure/unit-of-work/unit-of-work.module";
import { PrismaModule } from "../../prisma/prisma.module";
import { TenantTransactionService } from "../../prisma/tenant-transaction.service";
import { FilesModule, StoredFileAccess } from "../files/public-api";
import { NotificationsModule, NotificationsTransactionalPortsFactory } from "../notifications/public-api";
import { ReconcileKybOnFileVerdict } from "./application/event-handlers/in-transaction/reconcile-kyb-on-file-verdict.in-transaction-handler";
import type { TenantsScope } from "./application/tenants-scope";
import type { KybFileAccessPort } from "./application/ports/kyb-files.port";
import type { TenantAuditPort } from "./application/ports/tenant-audit.port";
import {
	INVITE_TOKENS,
	TENANTS_SCOPE_FACTORY,
	KYB_FILE_ACCESS,
	KYB_READ,
	MERCHANT_ADMIN_READ,
	TENANT_AUDIT,
	STORE_CLOSURE_FACTORY,
	TENANT_EMAILS,
	TENANTS_UNIT_OF_WORK,
	TEAM_READ,
} from "./application/ports/tenants.tokens";
import { AcceptTeamInviteHandler } from "./application/commands/accept-team-invite/accept-team-invite.handler";
import { CloseLocationHandler } from "./application/commands/close-location/close-location.handler";
import { CompleteMerchantOnboardingHandler } from "./application/commands/complete-merchant-onboarding/complete-merchant-onboarding.handler";
import { CompleteOnboardingDocumentUploadHandler } from "./application/commands/complete-onboarding-document-upload/complete-onboarding-document-upload.handler";
import { CompleteOnboardingDocumentUploadsHandler } from "./application/commands/complete-onboarding-document-uploads/complete-onboarding-document-uploads.handler";
import { CreateLocationAsAdminHandler } from "./application/commands/create-location-as-admin/create-location-as-admin.handler";
import { DecideKybHandler } from "./application/commands/decide-kyb/decide-kyb.handler";
import { InviteMemberHandler } from "./application/commands/invite-member/invite-member.handler";
import { ProposeLocationHandler } from "./application/commands/propose-location/propose-location.handler";
import { ProvisionMerchantFromAdminInviteHandler } from "./application/commands/provision-merchant-from-admin-invite/provision-merchant-from-admin-invite.handler";
import { ProvisionTenantFromPlatformInviteHandler } from "./application/commands/provision-tenant-from-platform-invite/provision-tenant-from-platform-invite.handler";
import { RegisterAndAcceptTeamInviteHandler } from "./application/commands/register-and-accept-team-invite/register-and-accept-team-invite.handler";
import { RemoveMemberFromStoreHandler } from "./application/commands/remove-member-from-store/remove-member-from-store.handler";
import { RenameOwnMembershipHandler } from "./application/commands/rename-own-membership/rename-own-membership.handler";
import { RequestOnboardingDocumentUploadHandler } from "./application/commands/request-onboarding-document-upload/request-onboarding-document-upload.handler";
import { RequestOnboardingDocumentUploadsHandler } from "./application/commands/request-onboarding-document-uploads/request-onboarding-document-uploads.handler";
import { RequestTenantAccessHandler } from "./application/commands/request-tenant-access/request-tenant-access.handler";
import { ResubmitLocationHandler } from "./application/commands/resubmit-location/resubmit-location.handler";
import { ReviewAccessRequestHandler } from "./application/commands/review-access-request/review-access-request.handler";
import { ReviewLocationHandler } from "./application/commands/review-location/review-location.handler";
import { RevokeInviteHandler } from "./application/commands/revoke-invite/revoke-invite.handler";
import { SubmitKybHandler } from "./application/commands/submit-kyb/submit-kyb.handler";
import { SubmitOnboardingDocumentsHandler } from "./application/commands/submit-onboarding-documents/submit-onboarding-documents.handler";
import { GetKybDocumentDownloadUrlHandler } from "./application/queries/get-kyb-document-download-url/get-kyb-document-download-url.handler";
import { GetKybProfileHandler } from "./application/queries/get-kyb-profile/get-kyb-profile.handler";
import { GetMerchantDetailHandler } from "./application/queries/get-merchant-detail/get-merchant-detail.handler";
import { GetOnboardingDocumentStatusHandler } from "./application/queries/get-onboarding-document-status/get-onboarding-document-status.handler";
import { GetTenantContextHandler } from "./application/queries/get-tenant-context/get-tenant-context.handler";
import { ListLocationRequestsHandler } from "./application/queries/list-location-requests/list-location-requests.handler";
import { ListMembersHandler } from "./application/queries/list-members/list-members.handler";
import { ListMerchantsHandler } from "./application/queries/list-merchants/list-merchants.handler";
import { ListMyMembershipsHandler } from "./application/queries/list-my-memberships/list-my-memberships.handler";
import { ListPendingInvitesHandler } from "./application/queries/list-pending-invites/list-pending-invites.handler";
import { GetMerchantInviteAvailabilityHandler } from "./application/queries/get-merchant-invite-availability/get-merchant-invite-availability.handler";
import { PreviewMerchantInviteEmailHandler } from "./application/queries/preview-merchant-invite-email/preview-merchant-invite-email.handler";
import { PreviewOnboardingInviteHandler } from "./application/queries/preview-onboarding-invite/preview-onboarding-invite.handler";
import { PreviewTeamInviteHandler } from "./application/queries/preview-team-invite/preview-team-invite.handler";
import { RandomInviteTokens } from "./infrastructure/adapters/invite-tokens.adapter";
import { KybFilesAdapter } from "./infrastructure/adapters/kyb-files.adapter";
import { TenantsFileRegistrations } from "./infrastructure/persistence/tenants-file-registrations";
import { MerchantInviteEmailPreviewAdapter } from "./infrastructure/adapters/tenant-emails.adapter";
import type { TenantAuditTransaction } from "./infrastructure/audit/tenant-audit.adapter";
import { TenantAccessModule } from "./infrastructure/tenant-access.module";
import { TenantsScopeFactory, type StoreClosureFactory } from "./infrastructure/persistence/tenants-scope.factory";
import { PrismaKybReadRepository } from "./infrastructure/persistence/prisma-kyb.read-repository";
import { PrismaMerchantAdminReadRepository } from "./infrastructure/persistence/prisma-merchant-admin.read-repository";
import { PrismaTeamReadRepository } from "./infrastructure/persistence/prisma-team.read-repository";
import { MerchantOnboardingController } from "./presentation/http/merchant-onboarding.controller";
import { RewardsAdminInvitesController, RewardsAdminLocationRequestsController, RewardsAdminMerchantsController } from "./presentation/http/merchant-admin.controller";
import { TenantAdminController } from "./presentation/http/tenant-admin.controller";
import { TenantKybController } from "./presentation/http/tenant-kyb.controller";
import { MembershipsBootstrapController } from "./presentation/http/tenant-memberships.controller";
import { TenantTeamInviteController } from "./presentation/http/tenant-team-invite.controller";
import { TenantController } from "./presentation/http/tenant.controller";

const HANDLERS = [
	AcceptTeamInviteHandler,
	CloseLocationHandler,
	CompleteMerchantOnboardingHandler,
	CompleteOnboardingDocumentUploadHandler,
	CompleteOnboardingDocumentUploadsHandler,
	CreateLocationAsAdminHandler,
	DecideKybHandler,
	InviteMemberHandler,
	ProposeLocationHandler,
	ProvisionMerchantFromAdminInviteHandler,
	ProvisionTenantFromPlatformInviteHandler,
	RegisterAndAcceptTeamInviteHandler,
	RemoveMemberFromStoreHandler,
	RenameOwnMembershipHandler,
	RequestOnboardingDocumentUploadHandler,
	RequestOnboardingDocumentUploadsHandler,
	RequestTenantAccessHandler,
	ResubmitLocationHandler,
	ReviewAccessRequestHandler,
	ReviewLocationHandler,
	RevokeInviteHandler,
	SubmitKybHandler,
	SubmitOnboardingDocumentsHandler,
	GetKybDocumentDownloadUrlHandler,
	GetKybProfileHandler,
	GetMerchantDetailHandler,
	GetOnboardingDocumentStatusHandler,
	GetTenantContextHandler,
	ListLocationRequestsHandler,
	ListMembersHandler,
	ListMerchantsHandler,
	ListMyMembershipsHandler,
	ListPendingInvitesHandler,
	PreviewMerchantInviteEmailHandler,
	GetMerchantInviteAvailabilityHandler,
	PreviewOnboardingInviteHandler,
	PreviewTeamInviteHandler,
];

/**
 * The tenants bounded context (plan §6.1, §7.5): tenants, members,
 * invitations, access requests, stores, KYB and merchant onboarding. The
 * access surface other contexts consume lives in `TenantAccessModule`.
 */
@Module({
	imports: [PrismaModule, UnitOfWorkModule, SystemCommandModule, TenantAccessModule, FilesModule, NotificationsModule],
	controllers: [
		TenantController,
		TenantTeamInviteController,
		TenantAdminController,
		MembershipsBootstrapController,
		TenantKybController,
		MerchantOnboardingController,
		RewardsAdminInvitesController,
		RewardsAdminLocationRequestsController,
		RewardsAdminMerchantsController,
	],
	providers: [
		{
			provide: TENANTS_SCOPE_FACTORY,
			inject: [STORE_CLOSURE_FACTORY, TENANT_AUDIT, StoredFileAccess, NotificationsTransactionalPortsFactory, TypedConfigService, LogService],
			useFactory: (
				storeClosure: StoreClosureFactory,
				audit: TenantAuditPort<TenantAuditTransaction>,
				storedFiles: StoredFileAccess,
				notifications: NotificationsTransactionalPortsFactory,
				config: TypedConfigService,
				logs: LogService,
			): TenantsScopeFactory => new TenantsScopeFactory({ storeClosure, audit, storedFiles, notifications, config, logs }),
		},
		{
			provide: TENANTS_UNIT_OF_WORK,
			inject: [TenantTransactionService, TENANTS_SCOPE_FACTORY, TransactionalEventDispatcher, AFTER_COMMIT_PUBLISHER],
			useFactory: (
				transactions: TenantTransactionService,
				scopes: TenantsScopeFactory,
				dispatcher: TransactionalEventDispatcher<Prisma.TransactionClient>,
				publisher: AfterCommitPublisher,
			): UnitOfWork<TenantsScope> => new PrismaUnitOfWork(transactions, scopes, dispatcher, publisher),
		},
		{
			provide: KYB_FILE_ACCESS,
			inject: [StoredFileAccess],
			useFactory: (files: StoredFileAccess): KybFileAccessPort => new KybFilesAdapter(files),
		},
		{
			provide: KYB_READ,
			inject: [TenantTransactionService, KYB_FILE_ACCESS],
			useFactory: (transactions: TenantTransactionService, files: KybFileAccessPort): PrismaKybReadRepository =>
				new PrismaKybReadRepository(new PrismaReadExecutor<Prisma.TransactionClient>(transactions), transactions, files),
		},
		{
			provide: TEAM_READ,
			inject: [TenantTransactionService],
			useFactory: (transactions: TenantTransactionService): PrismaTeamReadRepository =>
				new PrismaTeamReadRepository(new PrismaReadExecutor<Prisma.TransactionClient>(transactions), transactions),
		},
		{
			provide: MERCHANT_ADMIN_READ,
			inject: [TenantTransactionService, KYB_FILE_ACCESS],
			useFactory: (transactions: TenantTransactionService, files: KybFileAccessPort): PrismaMerchantAdminReadRepository =>
				new PrismaMerchantAdminReadRepository(transactions, files),
		},
		{ provide: INVITE_TOKENS, useClass: RandomInviteTokens },
		{
			provide: TENANT_EMAILS,
			inject: [TypedConfigService],
			useFactory: (config: TypedConfigService): MerchantInviteEmailPreviewAdapter => new MerchantInviteEmailPreviewAdapter(config),
		},
		TenantsFileRegistrations,
		...HANDLERS,
	],
	exports: [TenantAccessModule],
})
export class TenantsModule implements OnModuleInit {
	public constructor(
		@Inject(InTransactionEventRegistry) private readonly inTransactionHandlers: InTransactionEventRegistry<Prisma.TransactionClient>,
		@Inject(TENANTS_SCOPE_FACTORY) private readonly scopes: TenantsScopeFactory,
	) {}

	/** KYB review follows the files context's scan verdicts, inside the verdict's own transaction (mechanism 1). Registered exactly once. */
	public onModuleInit(): void {
		this.inTransactionHandlers.register(bindInTransactionHandler(new ReconcileKybOnFileVerdict(), this.scopes));
	}
}

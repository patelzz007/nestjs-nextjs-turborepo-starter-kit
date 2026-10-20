import type { TenantInvitationStatus, Prisma } from "@prisma/client";
import { epochMs, JsonObjectSchema, PilotCitySchema, type MerchantKybProfileResponse } from "@workspace/shared";

import { actingUserId, type ActorContext } from "../../../../platform/application/actor-context";
import type { PrismaReadExecutor } from "../../../../platform/infrastructure/unit-of-work/prisma-read-executor";
import type { TenantTransactionService } from "../../../../prisma/tenant-transaction.service";
import { toKybDocumentRecord } from "../../application/kyb-documents";
import type { KybFileAccessPort, KybFileDescriptor } from "../../application/ports/kyb-files.port";
import type { KybEvidenceReader, KybReadPort, OnboardingInviteView } from "../../application/ports/kyb-read.port";
import { merchantStatusOf } from "./merchant-admin.mapper";
import { TENANT_INVITATION_RESOLVE_TOKEN_OPERATION, MERCHANT_ADMIN_READ_OPERATION } from "../../application/ports/tenants.tokens";

export class PrismaKybReadRepository implements KybReadPort {
	public constructor(
		private readonly reads: PrismaReadExecutor<Prisma.TransactionClient>,
		private readonly transactions: TenantTransactionService,
		private readonly files: KybFileAccessPort,
	) {}

	public async getProfile(actor: ActorContext, tenantId: string): Promise<MerchantKybProfileResponse | null> {
		const loaded = await this.reads.read(actor, async (db) => {
			const org = await db.tenant.findUnique({ where: { id: tenantId }, include: { merchantProfile: true } });
			if (org?.merchantProfile == null) {
				return null;
			}
			const evidence = await db.tenantKybFile.findMany({
				where: { tenantId, isActive: true, isDeleted: false },
				select: { fileId: true },
				orderBy: { createdAt: "asc" },
			});
			return { org, profile: org.merchantProfile, evidenceFileIds: evidence.map((row) => row.fileId) };
		});
		if (loaded === null) {
			return null;
		}
		const { org, profile } = loaded;
		const files = await this.files.describe(loaded.evidenceFileIds);
		const kybFields = profile.kybFields === null ? null : JsonObjectSchema.safeParse(profile.kybFields);
		return {
			tenantId: org.id,
			businessName: org.displayName,
			legalName: profile.legalName,
			addressText: profile.addressText,
			contactPhone: profile.contactPhone,
			contactEmail: profile.contactEmail,
			city: profile.city,
			kybStatus: profile.kybStatus,
			kybFields: kybFields?.success === true ? kybFields.data : null,
			documents: loaded.evidenceFileIds.flatMap((fileId) => files.filter((file) => file.id === fileId).map(toKybDocumentRecord)),
			status: merchantStatusOf(org.lifecycleState),
		};
	}

	public async findActiveEvidence(actor: ActorContext, tenantId: string, fileId: string, reader: KybEvidenceReader): Promise<KybFileDescriptor | null> {
		const link = await this.readAs(actor, reader, async (db) =>
			db.tenantKybFile.findFirst({ where: { tenantId, fileId, isActive: true, isDeleted: false }, select: { fileId: true } }),
		);
		if (link === null) {
			return null;
		}
		const [file] = await this.files.describe([link.fileId]);
		return file ?? null;
	}

	public async findOnboardingInvite(tokenHash: string, statuses: readonly TenantInvitationStatus[]): Promise<OnboardingInviteView | null> {
		const invite = await this.transactions.withSystemOperation(
			{ operation: TENANT_INVITATION_RESOLVE_TOKEN_OPERATION, reason: "Resolve merchant onboarding invite by token", actorUserId: null },
			async (tx) =>
				tx.tenantInvitation.findFirst({
					where: { tokenHash, status: { in: [...statuses] }, kind: "PLATFORM_ONBOARDING" },
					include: { tenant: { select: { id: true, slug: true, displayName: true, merchantProfile: { select: { city: true } } } } },
				}),
		);
		const tenant = invite?.tenant ?? null;
		if (invite === null || tenant?.merchantProfile == null) {
			return null;
		}
		return {
			id: invite.id,
			email: invite.email,
			status: invite.status,
			tenantId: tenant.id,
			tenantSlug: tenant.slug,
			businessName: tenant.displayName,
			city: PilotCitySchema.parse(tenant.merchantProfile.city),
			expiresAt: epochMs(Number(invite.expiresAt)),
			acceptedByUserId: invite.acceptedByUserId,
			acceptedAt: invite.acceptedAt === null ? null : epochMs(Number(invite.acceptedAt)),
			documentsSubmittedAt: invite.documentsSubmittedAt === null ? null : epochMs(Number(invite.documentsSubmittedAt)),
		};
	}

	/** Admins read evidence across tenants (the route's `LIST MERCHANT_ORG` check ran); members under their own session. */
	private async readAs<TResult>(actor: ActorContext, reader: KybEvidenceReader, work: (db: Prisma.TransactionClient) => Promise<TResult>): Promise<TResult> {
		if (reader === "admin") {
			return this.transactions.withSystemOperation(
				{ operation: MERCHANT_ADMIN_READ_OPERATION, reason: "Read a merchant's KYB evidence for review", actorUserId: actingUserId(actor) },
				work,
			);
		}
		return this.reads.read(actor, work);
	}
}

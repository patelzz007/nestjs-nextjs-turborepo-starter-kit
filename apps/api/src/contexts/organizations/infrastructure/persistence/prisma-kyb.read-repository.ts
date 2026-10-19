import type { OrganizationInvitationStatus, Prisma } from "@prisma/client";
import { epochMs, JsonObjectSchema, PilotCitySchema, type MerchantKybProfileResponse } from "@workspace/shared";

import type { ActorContext } from "../../../../platform/application/actor-context";
import type { PrismaReadExecutor } from "../../../../platform/infrastructure/unit-of-work/prisma-read-executor";
import type { TenantTransactionService } from "../../../../prisma/tenant-transaction.service";
import { toKybDocumentRecord } from "../../application/kyb-documents";
import type { KybFileAccessPort, KybFileDescriptor } from "../../application/ports/kyb-files.port";
import type { KybEvidenceReader, KybReadPort, OnboardingInviteView } from "../../application/ports/kyb-read.port";
import { merchantStatusOf } from "./merchant-admin.mapper";

/** Allowlisted system operation that resolves an onboarding invite from its token (the merchant is signed out). */
const RESOLVE_TOKEN_OPERATION = "organization.invitation.resolve_token";

export class PrismaKybReadRepository implements KybReadPort {
	public constructor(
		private readonly reads: PrismaReadExecutor<Prisma.TransactionClient>,
		private readonly transactions: TenantTransactionService,
		private readonly files: KybFileAccessPort,
	) {}

	public async getProfile(actor: ActorContext, organizationId: string): Promise<MerchantKybProfileResponse | null> {
		const loaded = await this.reads.read(actor, async (db) => {
			const org = await db.organization.findUnique({ where: { id: organizationId }, include: { merchantProfile: true } });
			if (org?.merchantProfile == null) {
				return null;
			}
			const evidence = await db.organizationKybFile.findMany({
				where: { organizationId, isActive: true, isDeleted: false },
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
			organizationId: org.id,
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

	public async findActiveEvidence(actor: ActorContext, organizationId: string, fileId: string, reader: KybEvidenceReader): Promise<KybFileDescriptor | null> {
		const link = await this.readAs(actor, reader, async (db) =>
			db.organizationKybFile.findFirst({ where: { organizationId, fileId, isActive: true, isDeleted: false }, select: { fileId: true } }),
		);
		if (link === null) {
			return null;
		}
		const [file] = await this.files.describe([link.fileId]);
		return file ?? null;
	}

	public async findOnboardingInvite(tokenHash: string, statuses: readonly OrganizationInvitationStatus[]): Promise<OnboardingInviteView | null> {
		const invite = await this.transactions.withSystemOperation(
			{ operation: RESOLVE_TOKEN_OPERATION, reason: "Resolve merchant onboarding invite by token", actorUserId: null },
			async (tx) =>
				tx.organizationInvitation.findFirst({
					where: { tokenHash, status: { in: [...statuses] }, kind: "PLATFORM_ONBOARDING" },
					include: { organization: { select: { id: true, slug: true, displayName: true, merchantProfile: { select: { city: true } } } } },
				}),
		);
		const organization = invite?.organization ?? null;
		if (invite === null || organization?.merchantProfile == null) {
			return null;
		}
		return {
			id: invite.id,
			email: invite.email,
			status: invite.status,
			organizationId: organization.id,
			organizationSlug: organization.slug,
			businessName: organization.displayName,
			city: PilotCitySchema.parse(organization.merchantProfile.city),
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
				{ operation: "organization.merchant.admin_read", reason: "Read a merchant's KYB evidence for review", actorUserId: actor.kind === "user" ? actor.userId : null },
				work,
			);
		}
		return this.reads.read(actor, work);
	}
}

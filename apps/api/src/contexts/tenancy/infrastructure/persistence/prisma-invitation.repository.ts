import type { TenantInvitation, Prisma } from "@prisma/client";
import { epochMs, newRowId } from "@workspace/shared";

import { Invitation, type InvitationChange } from "../../domain/aggregates/invitation.aggregate";
import { InviteNoLongerPendingError, InvitePendingError, MerchantInviteUnavailableError, OnboardingDocumentsClosedError } from "../../domain/errors/tenants.errors";
import type { InvitationRepository } from "../../domain/repositories/invitation.repository";
import type { TenantsDb } from "./tenant-db";
import { withUniqueViolationAs } from "./unique-violation";

const SCOPE_INCLUDE = { locationScopes: { select: { locationId: true } } } satisfies Prisma.TenantInvitationInclude;

type InvitationRow = TenantInvitation & { readonly locationScopes: readonly { readonly locationId: string }[] };

function toInvitation(row: InvitationRow): Invitation {
	return Invitation.rehydrate({
		id: row.id,
		tenantId: row.tenantId,
		email: row.email,
		kind: row.kind,
		status: row.status,
		intendedRole: row.intendedRole,
		locationScopeType: row.locationScopeType,
		locationIds: row.locationScopes.map((scope) => scope.locationId),
		expiresAt: epochMs(Number(row.expiresAt)),
		acceptedByUserId: row.acceptedByUserId,
		acceptedAt: row.acceptedAt === null ? null : epochMs(Number(row.acceptedAt)),
		documentsSubmittedAt: row.documentsSubmittedAt === null ? null : epochMs(Number(row.documentsSubmittedAt)),
	});
}

export class PrismaInvitationRepository implements InvitationRepository {
	public constructor(private readonly db: TenantsDb) {}

	public nextId(): string {
		return newRowId();
	}

	public async findPendingTeamInviteByTokenHash(tokenHash: string): Promise<Invitation | null> {
		return this.findOne({ tokenHash, kind: "TEAM_MEMBER", status: "PENDING" });
	}

	public async findPendingTeamInvite(tenantId: string, invitationId: string): Promise<Invitation | null> {
		return this.findOne({ id: invitationId, tenantId, kind: "TEAM_MEMBER", status: "PENDING" });
	}

	public async findPendingTeamInviteByEmail(tenantId: string, email: string): Promise<Invitation | null> {
		return this.findOne({ tenantId, email, kind: "TEAM_MEMBER", status: "PENDING" });
	}

	public async findPendingOnboardingInviteByTokenHash(tokenHash: string): Promise<Invitation | null> {
		return this.findOne({ tokenHash, kind: "PLATFORM_ONBOARDING", status: "PENDING" });
	}

	public async findAcceptedOnboardingInviteByTokenHash(tokenHash: string): Promise<Invitation | null> {
		return this.findOne({ tokenHash, kind: "PLATFORM_ONBOARDING", status: "ACCEPTED" });
	}

	public async add(invitation: Invitation): Promise<void> {
		const change = invitation.pendingChange;
		if (change?.kind !== "issued" || invitation.tenantId === null) {
			throw new Error(`Invitation ${invitation.id} is not a new invitation`);
		}
		const { tenantId } = invitation;
		await withUniqueViolationAs(
			async () =>
				this.db.tenantInvitation.create({
					data: {
						id: invitation.id,
						tenantId,
						email: invitation.email,
						tokenHash: change.tokenHash,
						kind: invitation.kind,
						intendedRole: invitation.intendedRole,
						locationScopeType: invitation.scope.type,
						status: "PENDING",
						createdByAdminId: change.createdByUserId,
						expiresAt: BigInt(invitation.expiresAt),
						...(invitation.scope.coversAllLocations ? {} : { locationScopes: { create: invitation.scope.locationIds.map((locationId) => ({ tenantId, locationId })) } }),
					},
				}),
			() => new InvitePendingError(),
		);
	}

	public async save(invitation: Invitation): Promise<void> {
		const change = invitation.pendingChange;
		if (change === null || change.kind === "issued") {
			return;
		}
		const updated = await this.db.tenantInvitation.updateMany({ where: this.casWhere(invitation, change), data: this.casData(change) });
		if (updated.count !== 1) {
			throw this.lostRace(invitation, change);
		}
	}

	private casWhere(invitation: Invitation, change: Exclude<InvitationChange, { kind: "issued" }>): Prisma.TenantInvitationWhereInput {
		const base: Prisma.TenantInvitationWhereInput = { id: invitation.id, kind: invitation.kind };
		switch (change.kind) {
			case "accepted":
				return {
					...base,
					status: "PENDING",
					expiresAt: { gt: BigInt(change.at) },
					...(invitation.kind === "TEAM_MEMBER" ? { tenant: { is: { isDeleted: false } } } : {}),
				};
			case "revoked":
				return { ...base, tenantId: invitation.tenantId, status: "PENDING" };
			case "expired":
				return { ...base, status: "PENDING", expiresAt: { lte: BigInt(change.at) } };
			case "documents_submitted":
				return { ...base, status: "ACCEPTED", acceptedAt: { gte: BigInt(change.acceptedSince) }, documentsSubmittedAt: null };
		}
	}

	private casData(change: Exclude<InvitationChange, { kind: "issued" }>): Prisma.TenantInvitationUncheckedUpdateManyInput {
		const at = BigInt(change.at);
		switch (change.kind) {
			case "accepted":
				return { status: "ACCEPTED", acceptedByUserId: change.userId, acceptedAt: at, updatedAt: at };
			case "revoked":
				return { status: "REVOKED", updatedAt: at };
			case "expired":
				return { status: "EXPIRED", updatedAt: at };
			case "documents_submitted":
				return { documentsSubmittedAt: at, updatedAt: at };
		}
	}

	private lostRace(invitation: Invitation, change: Exclude<InvitationChange, { kind: "issued" }>): Error {
		if (change.kind === "documents_submitted") {
			return new OnboardingDocumentsClosedError();
		}
		return invitation.kind === "PLATFORM_ONBOARDING" ? new MerchantInviteUnavailableError() : new InviteNoLongerPendingError();
	}

	private async findOne(where: Prisma.TenantInvitationWhereInput): Promise<Invitation | null> {
		const row = await this.db.tenantInvitation.findFirst({ where, include: SCOPE_INCLUDE });
		return row === null ? null : toInvitation(row);
	}
}

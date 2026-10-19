import type { OrganizationInvitation, Prisma } from "@prisma/client";
import { epochMs, newRowId } from "@workspace/shared";

import { Invitation, type InvitationChange } from "../../domain/aggregates/invitation.aggregate";
import { InviteNoLongerPendingError, InvitePendingError, MerchantInviteUnavailableError, OnboardingDocumentsClosedError } from "../../domain/errors/organizations.errors";
import type { InvitationRepository } from "../../domain/repositories/invitation.repository";
import type { OrganizationsDb } from "./organization-db";
import { withUniqueViolationAs } from "./unique-violation";

const SCOPE_INCLUDE = { locationScopes: { select: { locationId: true } } } satisfies Prisma.OrganizationInvitationInclude;

type InvitationRow = OrganizationInvitation & { readonly locationScopes: readonly { readonly locationId: string }[] };

function toInvitation(row: InvitationRow): Invitation {
	return Invitation.rehydrate({
		id: row.id,
		organizationId: row.organizationId,
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
	public constructor(private readonly db: OrganizationsDb) {}

	public nextId(): string {
		return newRowId();
	}

	public async findPendingTeamInviteByTokenHash(tokenHash: string): Promise<Invitation | null> {
		return this.findOne({ tokenHash, kind: "TEAM_MEMBER", status: "PENDING" });
	}

	public async findPendingTeamInvite(organizationId: string, invitationId: string): Promise<Invitation | null> {
		return this.findOne({ id: invitationId, organizationId, kind: "TEAM_MEMBER", status: "PENDING" });
	}

	public async findPendingTeamInviteByEmail(organizationId: string, email: string): Promise<Invitation | null> {
		return this.findOne({ organizationId, email, kind: "TEAM_MEMBER", status: "PENDING" });
	}

	public async findPendingOnboardingInviteByTokenHash(tokenHash: string): Promise<Invitation | null> {
		return this.findOne({ tokenHash, kind: "PLATFORM_ONBOARDING", status: "PENDING" });
	}

	public async findAcceptedOnboardingInviteByTokenHash(tokenHash: string): Promise<Invitation | null> {
		return this.findOne({ tokenHash, kind: "PLATFORM_ONBOARDING", status: "ACCEPTED" });
	}

	public async add(invitation: Invitation): Promise<void> {
		const change = invitation.pendingChange;
		if (change?.kind !== "issued" || invitation.organizationId === null) {
			throw new Error(`Invitation ${invitation.id} is not a new invitation`);
		}
		const { organizationId } = invitation;
		await withUniqueViolationAs(
			async () =>
				this.db.organizationInvitation.create({
					data: {
						id: invitation.id,
						organizationId,
						email: invitation.email,
						tokenHash: change.tokenHash,
						kind: invitation.kind,
						intendedRole: invitation.intendedRole,
						locationScopeType: invitation.scope.type,
						status: "PENDING",
						createdByAdminId: change.createdByUserId,
						expiresAt: BigInt(invitation.expiresAt),
						...(invitation.scope.coversAllLocations ? {} : { locationScopes: { create: invitation.scope.locationIds.map((locationId) => ({ organizationId, locationId })) } }),
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
		const updated = await this.db.organizationInvitation.updateMany({ where: this.casWhere(invitation, change), data: this.casData(change) });
		if (updated.count !== 1) {
			throw this.lostRace(invitation, change);
		}
	}

	private casWhere(invitation: Invitation, change: Exclude<InvitationChange, { kind: "issued" }>): Prisma.OrganizationInvitationWhereInput {
		const base: Prisma.OrganizationInvitationWhereInput = { id: invitation.id, kind: invitation.kind };
		switch (change.kind) {
			case "accepted":
				return {
					...base,
					status: "PENDING",
					expiresAt: { gt: BigInt(change.at) },
					...(invitation.kind === "TEAM_MEMBER" ? { organization: { is: { isDeleted: false } } } : {}),
				};
			case "revoked":
				return { ...base, organizationId: invitation.organizationId, status: "PENDING" };
			case "expired":
				return { ...base, status: "PENDING", expiresAt: { lte: BigInt(change.at) } };
			case "documents_submitted":
				return { ...base, status: "ACCEPTED", acceptedAt: { gte: BigInt(change.acceptedSince) }, documentsSubmittedAt: null };
		}
	}

	private casData(change: Exclude<InvitationChange, { kind: "issued" }>): Prisma.OrganizationInvitationUncheckedUpdateManyInput {
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

	private async findOne(where: Prisma.OrganizationInvitationWhereInput): Promise<Invitation | null> {
		const row = await this.db.organizationInvitation.findFirst({ where, include: SCOPE_INCLUDE });
		return row === null ? null : toInvitation(row);
	}
}

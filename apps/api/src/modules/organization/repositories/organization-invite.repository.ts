import { Injectable } from "@nestjs/common";
import type { OrganizationInvitation, OrganizationInvitationStatus, OrganizationLocationScopeType, OrganizationMembershipRole, Prisma, PrismaClient } from "@prisma/client";

import { PrismaService } from "../../../prisma/prisma.service";

type DbTx = Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends">;

const TEAM_INVITE_INCLUDE = {
	organization: {
		select: {
			id: true,
			slug: true,
			displayName: true,
		},
	},
	locationScopes: {
		select: {
			locationId: true,
			location: {
				select: {
					id: true,
					name: true,
				},
			},
		},
	},
	createdByAdmin: {
		select: {
			id: true,
			fullName: true,
		},
	},
} satisfies Prisma.OrganizationInvitationInclude;

const ONBOARDING_INVITE_INCLUDE = {
	organization: {
		select: {
			id: true,
			slug: true,
			displayName: true,
			merchantProfile: { select: { city: true, kybStatus: true } },
		},
	},
} satisfies Prisma.OrganizationInvitationInclude;

export type OnboardingInviteRow = Prisma.OrganizationInvitationGetPayload<{ include: typeof ONBOARDING_INVITE_INCLUDE }>;

export type TeamInviteRow = Prisma.OrganizationInvitationGetPayload<{ include: typeof TEAM_INVITE_INCLUDE }>;

@Injectable()
export class OrganizationInviteRepository {
	public constructor(private readonly prisma: PrismaService) {}

	public async createOnboardingInvite(input: {
		readonly email: string;
		readonly tokenHash: string;
		readonly organizationId: string;
		readonly createdByAdminId: string;
		readonly expiresAt: number;
	}): Promise<OrganizationInvitation> {
		return this.prisma.organizationInvitation.create({
			data: {
				organizationId: input.organizationId,
				email: input.email,
				tokenHash: input.tokenHash,
				kind: "PLATFORM_ONBOARDING",
				intendedRole: "OWNER",
				locationScopeType: "ALL_LOCATIONS",
				status: "PENDING",
				createdByAdminId: input.createdByAdminId,
				expiresAt: BigInt(input.expiresAt),
			},
		});
	}

	public async createTeamInviteInTx(
		tx: DbTx,
		input: {
			readonly email: string;
			readonly tokenHash: string;
			readonly organizationId: string;
			readonly invitedByUserId: string;
			readonly intendedRole: OrganizationMembershipRole;
			readonly locationScopeType: OrganizationLocationScopeType;
			readonly locationIds: readonly string[];
			readonly expiresAt: number;
		},
	): Promise<OrganizationInvitation> {
		return tx.organizationInvitation.create({
			data: {
				organizationId: input.organizationId,
				email: input.email,
				tokenHash: input.tokenHash,
				kind: "TEAM_MEMBER",
				intendedRole: input.intendedRole,
				locationScopeType: input.locationScopeType,
				status: "PENDING",
				createdByAdminId: input.invitedByUserId,
				expiresAt: BigInt(input.expiresAt),
				...(input.locationScopeType === "SELECTED"
					? {
							locationScopes: {
								create: input.locationIds.map((locationId) => ({
									organizationId: input.organizationId,
									locationId,
								})),
							},
						}
					: {}),
			},
		});
	}

	public async findByTokenHash(tokenHash: string, statuses: readonly OrganizationInvitationStatus[] = ["PENDING"]): Promise<OnboardingInviteRow | null> {
		return this.prisma.organizationInvitation.findFirst({
			where: { tokenHash, status: { in: [...statuses] }, kind: "PLATFORM_ONBOARDING" },
			include: ONBOARDING_INVITE_INCLUDE,
		});
	}

	public async findTeamInviteByTokenHashInTx(tx: DbTx, tokenHash: string): Promise<TeamInviteRow | null> {
		return tx.organizationInvitation.findFirst({
			where: { tokenHash, kind: "TEAM_MEMBER", status: "PENDING" },
			include: TEAM_INVITE_INCLUDE,
		});
	}

	public async listPendingTeamInvitesInTx(tx: DbTx, organizationId: string): Promise<TeamInviteRow[]> {
		return tx.organizationInvitation.findMany({
			where: {
				organizationId,
				kind: "TEAM_MEMBER",
				status: "PENDING",
			},
			orderBy: { createdAt: "desc" },
			include: TEAM_INVITE_INCLUDE,
		});
	}

	public async findPendingTeamInviteInTx(tx: DbTx, organizationId: string, inviteId: string): Promise<TeamInviteRow | null> {
		return tx.organizationInvitation.findFirst({
			where: {
				id: inviteId,
				organizationId,
				kind: "TEAM_MEMBER",
				status: "PENDING",
			},
			include: TEAM_INVITE_INCLUDE,
		});
	}

	public async findPendingTeamInviteByEmailInTx(tx: DbTx, organizationId: string, email: string): Promise<OrganizationInvitation | null> {
		return tx.organizationInvitation.findFirst({
			where: {
				organizationId,
				email,
				kind: "TEAM_MEMBER",
				status: "PENDING",
			},
		});
	}

	/**
	 * Compare-and-set PENDING → ACCEPTED for a live merchant onboarding invite
	 * (still PENDING, unexpired). Runs first inside the onboarding transaction:
	 * the row lock serializes concurrent completions, so exactly one wins and a
	 * replayed or expired token returns `false`.
	 */
	public async claimPendingOnboardingInviteInTx(tx: DbTx, inviteId: string, userId: string, acceptedAt: number): Promise<boolean> {
		const result = await tx.organizationInvitation.updateMany({
			where: {
				id: inviteId,
				kind: "PLATFORM_ONBOARDING",
				status: "PENDING",
				expiresAt: { gt: BigInt(acceptedAt) },
			},
			data: {
				status: "ACCEPTED",
				acceptedByUserId: userId,
				acceptedAt: BigInt(acceptedAt),
				updatedAt: BigInt(acceptedAt),
			},
		});
		return result.count === 1;
	}

	/**
	 * An accepted onboarding invite whose single-use KYB document window is
	 * still open: accepted at or after `acceptedSince` and not yet consumed by
	 * a document submission. The window is enforced here, in the query.
	 */
	public async findOpenDocumentsWindowInvite(tokenHash: string, acceptedSince: number): Promise<OnboardingInviteRow | null> {
		return this.prisma.organizationInvitation.findFirst({
			where: {
				tokenHash,
				kind: "PLATFORM_ONBOARDING",
				status: "ACCEPTED",
				acceptedByUserId: { not: null },
				acceptedAt: { gte: BigInt(acceptedSince) },
				documentsSubmittedAt: null,
			},
			include: ONBOARDING_INVITE_INCLUDE,
		});
	}

	/** Consumes the document window exactly once (compare-and-set); `false` when it was already used or has closed. */
	public async consumeDocumentsWindowInTx(tx: DbTx, inviteId: string, acceptedSince: number, consumedAt: number): Promise<boolean> {
		const result = await tx.organizationInvitation.updateMany({
			where: {
				id: inviteId,
				kind: "PLATFORM_ONBOARDING",
				status: "ACCEPTED",
				acceptedAt: { gte: BigInt(acceptedSince) },
				documentsSubmittedAt: null,
			},
			data: { documentsSubmittedAt: BigInt(consumedAt), updatedAt: BigInt(consumedAt) },
		});
		return result.count === 1;
	}

	/**
	 * Compare-and-set PENDING → ACCEPTED for a live team invite: the row must
	 * still be PENDING, unexpired, and its organization not deleted. Returns
	 * whether THIS call won — a double accept, an accept after revoke and an
	 * accept after expiry all return `false`.
	 */
	public async acceptPendingTeamInviteInTx(tx: DbTx, inviteId: string, userId: string, acceptedAt: number): Promise<boolean> {
		const result = await tx.organizationInvitation.updateMany({
			where: {
				id: inviteId,
				kind: "TEAM_MEMBER",
				status: "PENDING",
				expiresAt: { gt: BigInt(acceptedAt) },
				organization: { is: { isDeleted: false } },
			},
			data: {
				status: "ACCEPTED",
				acceptedByUserId: userId,
				acceptedAt: BigInt(acceptedAt),
				updatedAt: BigInt(acceptedAt),
			},
		});
		return result.count === 1;
	}

	/** Compare-and-set PENDING → REVOKED for a team invite of `organizationId`; `false` when it is no longer pending. */
	public async revokePendingTeamInviteInTx(tx: DbTx, organizationId: string, inviteId: string, revokedAt: number): Promise<boolean> {
		const result = await tx.organizationInvitation.updateMany({
			where: { id: inviteId, organizationId, kind: "TEAM_MEMBER", status: "PENDING" },
			data: { status: "REVOKED", updatedAt: BigInt(revokedAt) },
		});
		return result.count === 1;
	}

	/** Compare-and-set PENDING → EXPIRED for a team invite whose expiry has passed; `false` when another request changed it first. */
	public async expirePendingTeamInviteInTx(tx: DbTx, inviteId: string, now: number): Promise<boolean> {
		const result = await tx.organizationInvitation.updateMany({
			where: { id: inviteId, kind: "TEAM_MEMBER", status: "PENDING", expiresAt: { lte: BigInt(now) } },
			data: { status: "EXPIRED", updatedAt: BigInt(now) },
		});
		return result.count === 1;
	}
}

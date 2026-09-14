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
} as const satisfies Prisma.OrganizationInvitationInclude;

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
				locationScopes:
					input.locationScopeType === "SELECTED"
						? {
								create: input.locationIds.map((locationId) => ({
									organizationId: input.organizationId,
									locationId,
								})),
							}
						: undefined,
			},
		});
	}

	public async findByTokenHash(
		tokenHash: string,
		statuses: readonly OrganizationInvitationStatus[] = ["PENDING"],
	): Promise<
		| (OrganizationInvitation & {
				organization: {
					id: string;
					slug: string;
					displayName: string;
					merchantProfile: { city: string } | null;
				} | null;
		  })
		| null
	> {
		return this.prisma.organizationInvitation.findFirst({
			where: { tokenHash, status: { in: [...statuses] }, kind: "PLATFORM_ONBOARDING" },
			include: {
				organization: {
					select: {
						id: true,
						slug: true,
						displayName: true,
						merchantProfile: { select: { city: true } },
					},
				},
			},
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

	public async markAcceptedInTx(tx: DbTx, inviteId: string, userId: string, acceptedAt: number): Promise<void> {
		await tx.organizationInvitation.update({
			where: { id: inviteId },
			data: {
				status: "ACCEPTED",
				acceptedByUserId: userId,
				acceptedAt: BigInt(acceptedAt),
				updatedAt: BigInt(acceptedAt),
			},
		});
	}

	public async markRevokedInTx(tx: DbTx, inviteId: string, revokedAt: number): Promise<void> {
		await tx.organizationInvitation.update({
			where: { id: inviteId },
			data: {
				status: "REVOKED",
				updatedAt: BigInt(revokedAt),
			},
		});
	}
}

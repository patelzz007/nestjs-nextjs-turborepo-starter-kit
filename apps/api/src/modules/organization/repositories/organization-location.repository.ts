import { Injectable } from "@nestjs/common";
import type { OrganizationLocation, OrganizationLocationStatus, PilotCity, Prisma, PrismaClient } from "@prisma/client";
import { PrismaService } from "../../../prisma/prisma.service";
import { allocateUniqueLocationCode } from "../utils/organization-location-code.util";

type DbTx = Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends">;

const ADMIN_LOCATION_REQUEST_INCLUDE = {
	organization: {
		select: {
			id: true,
			slug: true,
			displayName: true,
		},
	},
} as const satisfies Prisma.OrganizationLocationInclude;

export type AdminLocationRequestRow = Prisma.OrganizationLocationGetPayload<{ include: typeof ADMIN_LOCATION_REQUEST_INCLUDE }>;

export interface CreateOrganizationLocationData {
	readonly organizationId: string;
	readonly name: string;
	readonly addressText: string;
	readonly city: PilotCity | null;
	readonly contactPhone: string | null;
	readonly status: OrganizationLocationStatus;
	readonly isPrimary: boolean;
	readonly requestedByUserId: string | null;
	readonly reviewedByUserId: string | null;
	readonly reviewedAt: bigint | null;
}

@Injectable()
export class OrganizationLocationRepository {
	public constructor(private readonly prisma: PrismaService) {}

	public async findById(organizationId: string, locationId: string): Promise<OrganizationLocation | null> {
		return this.prisma.organizationLocation.findFirst({
			where: { id: locationId, organizationId, isDeleted: false },
		});
	}

	public async findPrimary(organizationId: string): Promise<OrganizationLocation | null> {
		return this.prisma.organizationLocation.findFirst({
			where: { organizationId, isPrimary: true, isDeleted: false },
		});
	}

	public async countPendingByOrganization(organizationId: string): Promise<number> {
		return this.prisma.organizationLocation.count({
			where: { organizationId, isDeleted: false, status: "PENDING_APPROVAL" },
		});
	}

	public async countActiveByOrganization(organizationId: string): Promise<number> {
		return this.prisma.organizationLocation.count({
			where: { organizationId, isDeleted: false, status: "ACTIVE" },
		});
	}

	public async findActiveIds(organizationId: string, locationIds: readonly string[]): Promise<string[]> {
		const rows = await this.prisma.organizationLocation.findMany({
			where: {
				organizationId,
				isDeleted: false,
				status: "ACTIVE",
				id: { in: [...locationIds] },
			},
			select: { id: true },
		});
		return rows.map((row) => row.id);
	}

	public async listAdminRequests(status: OrganizationLocationStatus, skip: number, take: number): Promise<AdminLocationRequestRow[]> {
		return this.prisma.organizationLocation.findMany({
			where: { isDeleted: false, status, isPrimary: false },
			orderBy: { createdAt: "asc" },
			skip,
			take,
			include: ADMIN_LOCATION_REQUEST_INCLUDE,
		});
	}

	public async listAdminRequestsInTx(tx: DbTx, status: OrganizationLocationStatus, skip: number, take: number): Promise<AdminLocationRequestRow[]> {
		return tx.organizationLocation.findMany({
			where: { isDeleted: false, status, isPrimary: false },
			orderBy: { createdAt: "asc" },
			skip,
			take,
			include: ADMIN_LOCATION_REQUEST_INCLUDE,
		});
	}

	public async countAdminRequests(status: OrganizationLocationStatus): Promise<number> {
		return this.prisma.organizationLocation.count({
			where: { isDeleted: false, status, isPrimary: false },
		});
	}

	public async create(tx: DbTx, data: CreateOrganizationLocationData): Promise<OrganizationLocation> {
		const code = await allocateUniqueLocationCode(tx, data.organizationId, data.name);
		const now = BigInt(Date.now());

		return tx.organizationLocation.create({
			data: {
				organizationId: data.organizationId,
				name: data.name.trim(),
				code,
				addressText: data.addressText.trim(),
				city: data.city,
				contactPhone: data.contactPhone,
				status: data.status,
				isPrimary: data.isPrimary,
				requestedByUserId: data.requestedByUserId,
				reviewedByUserId: data.reviewedByUserId,
				reviewedAt: data.reviewedAt,
				createdAt: now,
				updatedAt: now,
			},
		});
	}

	public async listByOrganization(organizationId: string): Promise<OrganizationLocation[]> {
		return this.prisma.organizationLocation.findMany({
			where: { organizationId, isDeleted: false },
			orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
		});
	}

	public async updatePrimaryFromOnboarding(
		tx: DbTx,
		organizationId: string,
		input: {
			readonly name: string;
			readonly addressText: string;
			readonly city: PilotCity;
			readonly contactPhone: string;
			readonly reviewedByUserId: string;
		},
	): Promise<OrganizationLocation> {
		const primary = await tx.organizationLocation.findFirst({
			where: { organizationId, isPrimary: true, isDeleted: false },
		});

		if (primary === null) {
			throw new Error("Primary organization location is missing");
		}

		const now = BigInt(Date.now());

		return tx.organizationLocation.update({
			where: { id: primary.id },
			data: {
				name: input.name.trim(),
				addressText: input.addressText.trim(),
				city: input.city,
				contactPhone: input.contactPhone.trim(),
				status: "ACTIVE",
				reviewedByUserId: input.reviewedByUserId,
				reviewedAt: now,
				updatedAt: now,
			},
		});
	}

	public async updateRejectedLocation(
		tx: DbTx,
		locationId: string,
		input: {
			readonly name: string;
			readonly addressText: string;
			readonly contactPhone: string | null;
			readonly requestedByUserId: string;
		},
	): Promise<OrganizationLocation> {
		const now = BigInt(Date.now());

		return tx.organizationLocation.update({
			where: { id: locationId },
			data: {
				name: input.name.trim(),
				addressText: input.addressText.trim(),
				contactPhone: input.contactPhone,
				status: "PENDING_APPROVAL",
				rejectionReason: null,
				requestedByUserId: input.requestedByUserId,
				reviewedByUserId: null,
				reviewedAt: null,
				updatedAt: now,
			},
		});
	}

	public async reviewLocation(
		tx: DbTx,
		locationId: string,
		input: {
			readonly approve: boolean;
			readonly rejectionReason: string | null;
			readonly reviewedByUserId: string;
		},
	): Promise<OrganizationLocation> {
		const now = BigInt(Date.now());

		return tx.organizationLocation.update({
			where: { id: locationId },
			data: {
				status: input.approve ? "ACTIVE" : "REJECTED",
				rejectionReason: input.approve ? null : input.rejectionReason,
				reviewedByUserId: input.reviewedByUserId,
				reviewedAt: now,
				updatedAt: now,
			},
		});
	}
}

import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import type { MerchantMembershipResponse } from "@workspace/shared";

import { AuthorizationCheckerService } from "../../authorization/services/authorization-checker.service";
import { PrismaService } from "../../../prisma/prisma.service";

@Injectable()
export class MerchantContextService {
	public constructor(
		private readonly prisma: PrismaService,
		private readonly authorizationChecker: AuthorizationCheckerService,
	) {}

	public async resolveOrgIdForUser(userId: string, requestedOrgId: string | undefined): Promise<string> {
		const memberships = await this.prisma.merchantMember.findMany({
			where: { userId, isDeleted: false },
			select: { merchantOrgId: true, role: true },
		});

		if (memberships.length === 0) {
			if (requestedOrgId !== undefined && requestedOrgId.length > 0) {
				const canManageMerchants = await this.authorizationChecker.hasPermission(userId, "MANAGE", "MERCHANT_ORG");
				if (canManageMerchants) {
					await this.assertMerchantOrgExists(requestedOrgId);
					return requestedOrgId;
				}
			}

			throw new ForbiddenException({ message: "Not a merchant member", error: "MERCHANT_MEMBER_REQUIRED" });
		}

		if (requestedOrgId !== undefined && requestedOrgId.length > 0) {
			const match = memberships.find((row) => row.merchantOrgId === requestedOrgId);
			if (match === undefined) {
				const canManageMerchants = await this.authorizationChecker.hasPermission(userId, "MANAGE", "MERCHANT_ORG");
				if (canManageMerchants) {
					await this.assertMerchantOrgExists(requestedOrgId);
					return requestedOrgId;
				}

				throw new ForbiddenException({ message: "Invalid merchant org", error: "MERCHANT_ORG_FORBIDDEN" });
			}
			return requestedOrgId;
		}

		return memberships[0].merchantOrgId;
	}

	public async requireOwner(userId: string, merchantOrgId: string): Promise<void> {
		const membership = await this.prisma.merchantMember.findFirst({
			where: { userId, merchantOrgId, isDeleted: false },
		});

		if (membership !== null && membership.role === "OWNER") {
			return;
		}

		const canManageMerchants = await this.authorizationChecker.hasPermission(userId, "MANAGE", "MERCHANT_ORG");
		if (canManageMerchants) {
			await this.assertMerchantOrgExists(merchantOrgId);
			return;
		}

		throw new ForbiddenException({ message: "Owner role required", error: "MERCHANT_OWNER_REQUIRED" });
	}

	public async listMembershipsForUser(userId: string): Promise<MerchantMembershipResponse[]> {
		const memberships = await this.prisma.merchantMember.findMany({
			where: { userId, isDeleted: false },
			include: {
				merchantOrg: {
					select: {
						id: true,
						businessName: true,
						city: true,
						kybStatus: true,
						status: true,
						isDeleted: true,
					},
				},
			},
			orderBy: { createdAt: "asc" },
		});

		const memberRows: MerchantMembershipResponse[] = memberships
			.filter((row) => row.merchantOrg.isDeleted === false)
			.map((row) => ({
				merchantOrgId: row.merchantOrgId,
				businessName: row.merchantOrg.businessName,
				city: row.merchantOrg.city,
				role: row.role,
				kybStatus: row.merchantOrg.kybStatus,
				status: row.merchantOrg.status,
			}));

		if (memberRows.length > 0) {
			return memberRows;
		}

		const canManageMerchants = await this.authorizationChecker.hasPermission(userId, "MANAGE", "MERCHANT_ORG");
		if (!canManageMerchants) {
			return memberRows;
		}

		const orgs = await this.prisma.merchantOrg.findMany({
			where: { isDeleted: false },
			orderBy: { businessName: "asc" },
			take: 100,
			select: {
				id: true,
				businessName: true,
				city: true,
				kybStatus: true,
				status: true,
			},
		});

		return orgs.map((org) => ({
			merchantOrgId: org.id,
			businessName: org.businessName,
			city: org.city,
			role: "OWNER",
			kybStatus: org.kybStatus,
			status: org.status,
		}));
	}

	private async assertMerchantOrgExists(merchantOrgId: string): Promise<void> {
		const org = await this.prisma.merchantOrg.findFirst({
			where: { id: merchantOrgId, isDeleted: false },
			select: { id: true },
		});

		if (org === null) {
			throw new NotFoundException({ message: "Merchant not found", error: "MERCHANT_NOT_FOUND" });
		}
	}
}

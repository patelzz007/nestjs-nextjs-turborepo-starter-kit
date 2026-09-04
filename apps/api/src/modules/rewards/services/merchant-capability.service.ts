import { Injectable } from "@nestjs/common";
import type { MerchantMemberRole } from "@prisma/client";
import { type MerchantCapability, parseMerchantCapabilities } from "@workspace/shared";

import { PrismaService } from "../../../prisma/prisma.service";

type CapabilityCache = Readonly<Record<MerchantMemberRole, readonly MerchantCapability[]>>;

/**
 * Loads merchant portal capabilities from `merchant_role_capabilities`.
 * Cached in-memory per process — restart or an admin mutation hook can clear it later.
 */
@Injectable()
export class MerchantCapabilityService {
	private cache: CapabilityCache | null = null;

	public constructor(private readonly prisma: PrismaService) {}

	public async getCapabilitiesForRole(role: MerchantMemberRole): Promise<readonly MerchantCapability[]> {
		const map = await this.loadCache();
		return map[role];
	}

	public async getOwnerCapabilities(): Promise<readonly MerchantCapability[]> {
		return this.getCapabilitiesForRole("OWNER");
	}

	public invalidateCache(): void {
		this.cache = null;
	}

	private async loadCache(): Promise<CapabilityCache> {
		if (this.cache !== null) {
			return this.cache;
		}

		const rows = await this.prisma.merchantRoleCapability.findMany({
			where: { isDeleted: false },
			select: { role: true, capability: true },
			orderBy: [{ role: "asc" }, { capability: "asc" }],
		});

		const ownerCapabilities = parseMerchantCapabilities(rows.filter((row) => row.role === "OWNER").map((row) => row.capability));
		const cashierCapabilities = parseMerchantCapabilities(rows.filter((row) => row.role === "CASHIER").map((row) => row.capability));

		this.cache = {
			OWNER: ownerCapabilities,
			CASHIER: cashierCapabilities,
		};

		return this.cache;
	}
}

import { Injectable, OnModuleInit } from "@nestjs/common";
import type { MerchantMemberRole } from "@prisma/client";
import {
	type CapabilitySlug,
	CapabilitySlugSchema,
	type MerchantMemberRole as SharedMerchantMemberRole,
	type MerchantRoleCapabilityGrant,
	MerchantMemberRoleSchema,
	parseCapabilitySlugs,
} from "@workspace/shared";

import { PrismaService } from "../../../prisma/prisma.service";
import { CapabilityDefinitionService } from "../../authorization/services/capability-definition.service";
import { DEFAULT_MERCHANT_ROLE_CAPABILITY_GRANTS } from "../constants/merchant-role-capability-defaults";

type CapabilityCache = Readonly<Record<MerchantMemberRole, readonly CapabilitySlug[]>>;

/**
 * Loads merchant portal capabilities from `merchant_role_capabilities` + catalog.
 * Cached in-memory per process — cleared via {@link invalidateCache} after admin updates.
 */
@Injectable()
export class MerchantCapabilityService implements OnModuleInit {
	private cache: CapabilityCache | null = null;

	public constructor(
		private readonly prisma: PrismaService,
		private readonly capabilityDefinitions: CapabilityDefinitionService,
	) {}

	public async onModuleInit(): Promise<void> {
		await this.bootstrapDefaultsIfTableEmpty();
	}

	public async getCapabilitiesForRole(role: MerchantMemberRole): Promise<readonly CapabilitySlug[]> {
		const map = await this.loadCache();
		return map[role];
	}

	public async getOwnerCapabilities(): Promise<readonly CapabilitySlug[]> {
		return this.getCapabilitiesForRole("OWNER");
	}

	public async listRoleCapabilityGrants(): Promise<MerchantRoleCapabilityGrant[]> {
		const map = await this.loadCache();
		return MerchantMemberRoleSchema.options.map((role: SharedMerchantMemberRole) => ({
			role,
			capabilities: [...map[role]],
		}));
	}

	public async syncRoleCapabilities(role: MerchantMemberRole, capabilities: readonly CapabilitySlug[]): Promise<MerchantRoleCapabilityGrant> {
		const catalog = await this.capabilityDefinitions.listCatalog("MERCHANT");
		const catalogSlugs = new Set<CapabilitySlug>(catalog.map((entry) => entry.slug));

		const uniqueCapabilities: CapabilitySlug[] = [];
		for (const capability of capabilities) {
			const parsed = CapabilitySlugSchema.safeParse(capability);
			if (parsed.success && catalogSlugs.has(parsed.data) && !uniqueCapabilities.includes(parsed.data)) {
				uniqueCapabilities.push(parsed.data);
			}
		}

		const definitions = await this.prisma.capabilityDefinition.findMany({
			where: {
				isDeleted: false,
				scope: "MERCHANT",
				slug: { in: uniqueCapabilities },
			},
			select: { id: true, slug: true },
		});

		const slugToId = new Map<CapabilitySlug, string>();
		for (const definition of definitions) {
			const parsed = CapabilitySlugSchema.safeParse(definition.slug);
			if (parsed.success) {
				slugToId.set(parsed.data, definition.id);
			}
		}

		const desiredIds = new Set<string>();
		for (const slug of uniqueCapabilities) {
			const id = slugToId.get(slug);
			if (id !== undefined) {
				desiredIds.add(id);
			}
		}

		const now: number = Date.now();

		await this.prisma.$transaction(async (tx) => {
			const existing = await tx.merchantRoleCapability.findMany({
				where: { role },
				select: { id: true, capabilityId: true, isDeleted: true },
			});

			for (const row of existing) {
				if (!desiredIds.has(row.capabilityId) && !row.isDeleted) {
					await tx.merchantRoleCapability.update({
						where: { id: row.id },
						data: { isDeleted: true, deletedAt: now, updatedAt: now },
					});
				}
			}

			for (const capabilityId of desiredIds) {
				await tx.merchantRoleCapability.upsert({
					where: {
						role_capabilityId: {
							role,
							capabilityId,
						},
					},
					create: {
						role,
						capabilityId,
					},
					update: {
						isDeleted: false,
						deletedAt: null,
						updatedAt: now,
					},
				});
			}
		});

		this.invalidateCache();
		this.capabilityDefinitions.invalidateCache();

		return {
			role,
			capabilities: uniqueCapabilities,
		};
	}

	public async restoreRoleDefaults(role: MerchantMemberRole): Promise<MerchantRoleCapabilityGrant> {
		return this.syncRoleCapabilities(role, DEFAULT_MERCHANT_ROLE_CAPABILITY_GRANTS[role]);
	}

	public invalidateCache(): void {
		this.cache = null;
	}

	private async loadCache(): Promise<CapabilityCache> {
		if (this.cache !== null) {
			return this.cache;
		}

		await this.bootstrapDefaultsIfTableEmpty();

		const rows = await this.prisma.merchantRoleCapability.findMany({
			where: { isDeleted: false },
			select: {
				role: true,
				capability: { select: { slug: true } },
			},
			orderBy: [{ role: "asc" }, { capability: { slug: "asc" } }],
		});

		const ownerCapabilities = parseCapabilitySlugs(rows.filter((row) => row.role === "OWNER").map((row) => row.capability.slug));
		const cashierCapabilities = parseCapabilitySlugs(rows.filter((row) => row.role === "CASHIER").map((row) => row.capability.slug));

		this.cache = {
			OWNER: ownerCapabilities,
			CASHIER: cashierCapabilities,
		};

		return this.cache;
	}

	private async bootstrapDefaultsIfTableEmpty(): Promise<void> {
		const activeCount = await this.prisma.merchantRoleCapability.count({
			where: { isDeleted: false },
		});

		if (activeCount > 0) {
			return;
		}

		for (const role of MerchantMemberRoleSchema.options) {
			await this.syncRoleCapabilities(role, DEFAULT_MERCHANT_ROLE_CAPABILITY_GRANTS[role]);
		}
	}
}

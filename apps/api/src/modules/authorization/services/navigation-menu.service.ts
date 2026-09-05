import { Injectable } from "@nestjs/common";
import type { MenuMatchType } from "@prisma/client";
import {
	CapabilityMenuResponseSchema,
	CapabilitySlugSchema,
	type CapabilityMenuItem,
	type CapabilityMenuResponse,
	type CapabilityScope,
	type CapabilitySlug,
} from "@workspace/shared";

import { PrismaService } from "../../../prisma/prisma.service";

interface MenuRow {
	readonly id: string;
	readonly name: string;
	readonly label: string | null;
	readonly icon: string | null;
	readonly path: string | null;
	readonly parentId: string | null;
	readonly order: number;
	readonly isActive: boolean;
	readonly capabilities: readonly { readonly slug: string; readonly matchType: MenuMatchType }[];
}

interface MenuItemCapabilityLink {
	readonly menuItemId: string;
	readonly slug: string;
	readonly matchType: MenuMatchType;
}

/**
 * Builds navigation trees from `menu_items` + `menu_item_capabilities`.
 * Scope selects which app surface (ADMIN, MERCHANT, PLATFORM) to serve.
 */
@Injectable()
export class NavigationMenuService {
	public constructor(private readonly prisma: PrismaService) {}

	public async getMenu(scope: CapabilityScope, header: { readonly title: string; readonly subtitle: string }): Promise<CapabilityMenuResponse> {
		const [rows, capabilityLinks] = await Promise.all([this.loadMenuItems(scope), this.loadCapabilityLinks(scope)]);
		const capabilitiesByMenuItemId = this.groupCapabilitiesByMenuItem(capabilityLinks);

		const mapped: MenuRow[] = rows.map((row) => ({
			id: row.id,
			name: row.name,
			label: row.label,
			icon: row.icon,
			path: row.path,
			parentId: row.parentId,
			order: row.order,
			isActive: row.isActive,
			capabilities: capabilitiesByMenuItemId.get(row.id) ?? [],
		}));

		const roots = mapped.filter((row) => row.parentId === null);
		const sections = roots
			.map((root) => {
				const childRows = mapped.filter((entry) => entry.parentId === root.id).sort((left, right) => left.order - right.order);
				const items = childRows.length > 0 ? childRows.map((row) => this.buildNode(row, mapped)) : [this.buildNode(root, mapped)];
				return {
					title: root.label ?? root.name,
					items: items.filter((node) => node.children.length > 0 || node.url.length > 0),
				};
			})
			.filter((section) => section.items.length > 0);

		const response: CapabilityMenuResponse = {
			header,
			sections:
				sections.length > 0
					? sections
					: [{ title: "Navigation", items: roots.map((row) => this.buildNode(row, mapped)).filter((node) => node.children.length > 0 || node.url.length > 0) }],
		};

		return CapabilityMenuResponseSchema.parse(response);
	}

	private async loadMenuItems(scope: CapabilityScope): Promise<
		readonly {
			readonly id: string;
			readonly name: string;
			readonly label: string | null;
			readonly icon: string | null;
			readonly path: string | null;
			readonly parentId: string | null;
			readonly order: number;
			readonly isActive: boolean;
		}[]
	> {
		return this.prisma.menuItem.findMany({
			where: {
				isDeleted: false,
				isActive: true,
				scope,
			},
			orderBy: [{ order: "asc" }, { name: "asc" }],
			select: {
				id: true,
				name: true,
				label: true,
				icon: true,
				path: true,
				parentId: true,
				order: true,
				isActive: true,
			},
		});
	}

	private async loadCapabilityLinks(scope: CapabilityScope): Promise<readonly MenuItemCapabilityLink[]> {
		const rows = await this.prisma.menuItemCapability.findMany({
			where: {
				isDeleted: false,
				menuItem: {
					isDeleted: false,
					isActive: true,
					scope,
				},
			},
			select: {
				menuItemId: true,
				matchType: true,
				capability: { select: { slug: true } },
			},
		});

		const links: MenuItemCapabilityLink[] = [];
		for (const row of rows) {
			links.push({
				menuItemId: row.menuItemId,
				matchType: row.matchType,
				slug: row.capability.slug,
			});
		}
		return links;
	}

	private groupCapabilitiesByMenuItem(links: readonly MenuItemCapabilityLink[]): ReadonlyMap<string, MenuRow["capabilities"]> {
		const grouped = new Map<string, { slug: string; matchType: MenuMatchType }[]>();
		for (const link of links) {
			const bucket = grouped.get(link.menuItemId) ?? [];
			bucket.push({ slug: link.slug, matchType: link.matchType });
			grouped.set(link.menuItemId, bucket);
		}
		return grouped;
	}

	private buildNode(row: MenuRow, allRows: readonly MenuRow[]): CapabilityMenuItem {
		const children = allRows
			.filter((entry) => entry.parentId === row.id)
			.sort((left, right) => left.order - right.order)
			.map((entry) => this.buildNode(entry, allRows));

		const requiredCapabilities: CapabilitySlug[] = [];
		for (const capability of row.capabilities) {
			const parsed = CapabilitySlugSchema.safeParse(capability.slug);
			if (parsed.success) {
				requiredCapabilities.push(parsed.data);
			}
		}

		return {
			id: row.id,
			title: row.label ?? row.name,
			url: row.path ?? "#",
			icon: row.icon,
			disabled: !row.isActive,
			requiredCapabilities,
			matchType: row.capabilities[0]?.matchType ?? "ANY",
			children,
		};
	}
}

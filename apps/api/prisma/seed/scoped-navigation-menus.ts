import type { CapabilityScope, MenuMatchType } from "@prisma/client";

import { prisma } from "./client";

interface ScopedMenuSeedNode {
	readonly name: string;
	readonly label?: string;
	readonly icon: string;
	readonly path: string | null;
	readonly order: number;
	readonly parentName?: string;
	readonly capabilitySlugs?: readonly string[];
	readonly matchType?: MenuMatchType;
	readonly children?: readonly ScopedMenuSeedNode[];
}

const MERCHANT_MENU: readonly ScopedMenuSeedNode[] = [
	{
		name: "merchant-overview",
		label: "Overview",
		icon: "LayoutDashboard",
		path: null,
		order: 0,
		children: [
			{
				name: "merchant-dashboard",
				label: "Dashboard",
				icon: "LayoutDashboard",
				path: "/",
				order: 0,
				capabilitySlugs: ["merchant:view_dashboard"],
			},
		],
	},
	{
		name: "merchant-rewards-section",
		label: "Rewards",
		icon: "Gift",
		path: null,
		order: 1,
		children: [
			{
				name: "merchant-rewards",
				label: "My Rewards",
				icon: "Gift",
				path: "/rewards",
				order: 0,
				capabilitySlugs: ["merchant:view_rewards"],
				children: [
					{ name: "merchant-rewards-all", label: "All Rewards", icon: "List", path: "/rewards", order: 0, capabilitySlugs: ["merchant:view_rewards"] },
					{ name: "merchant-rewards-new", label: "Create New", icon: "PlusCircle", path: "/rewards/new", order: 1, capabilitySlugs: ["merchant:manage_rewards"] },
				],
			},
		],
	},
	{
		name: "merchant-operations-section",
		label: "Operations",
		icon: "QrCode",
		path: null,
		order: 2,
		children: [
			{ name: "merchant-redemptions", label: "Redemptions", icon: "CheckCircle", path: "/redemptions", order: 0, capabilitySlugs: ["merchant:view_redemptions"] },
			{ name: "merchant-api-keys", label: "API Keys", icon: "KeyRound", path: "/api-keys", order: 1, capabilitySlugs: ["merchant:manage_api_keys"] },
		],
	},
	{
		name: "merchant-insights-section",
		label: "Insights",
		icon: "BarChart2",
		path: null,
		order: 3,
		children: [{ name: "merchant-analytics", label: "Analytics", icon: "BarChart2", path: "/analytics", order: 0, capabilitySlugs: ["merchant:view_analytics"] }],
	},
];

const ADMIN_MENU: readonly ScopedMenuSeedNode[] = [
	{ name: "admin-overview", label: "Overview", icon: "LayoutDashboard", path: "/", order: 0 },
	{
		name: "admin-rewardhub",
		label: "Reward Hub",
		icon: "Gift",
		path: null,
		order: 1,
		children: [
			{ name: "admin-rewardhub-merchants", label: "Merchants", icon: "Package", path: "/rewardhub/merchants", order: 0 },
			{ name: "admin-rewardhub-users", label: "Users", icon: "Users", path: "/rewardhub/users", order: 1 },
			{ name: "admin-rewardhub-pending", label: "Pending rewards", icon: "ListChecks", path: "/rewardhub/pending", order: 2 },
			{ name: "admin-rewardhub-invites", label: "Merchant invites", icon: "Send", path: "/rewardhub/invites", order: 3 },
			{ name: "admin-rewardhub-role-capabilities", label: "Merchant roles", icon: "Shield", path: "/rewardhub/role-capabilities", order: 4 },
			{ name: "admin-rewardhub-kyb", label: "KYB review", icon: "ShieldCheck", path: "/rewardhub/kyb", order: 5 },
		],
	},
];

async function loadCapabilityIds(): Promise<Map<string, string>> {
	const rows = await prisma.capabilityDefinition.findMany({
		where: { isDeleted: false },
		select: { id: true, slug: true },
	});
	const map = new Map<string, string>();
	for (const row of rows) {
		map.set(row.slug, row.id);
	}
	return map;
}

async function upsertScopedMenuNode(node: ScopedMenuSeedNode, scope: CapabilityScope, parentId: string | null, capabilityIds: ReadonlyMap<string, string>): Promise<string> {
	const existing = await prisma.menuItem.findFirst({
		where: { name: node.name, scope, isDeleted: false },
	});

	const menuItem =
		existing !== null
			? await prisma.menuItem.update({
					where: { id: existing.id },
					data: {
						label: node.label ?? node.name,
						icon: node.icon,
						path: node.path,
						parentId,
						order: node.order,
						isActive: true,
						scope,
					},
				})
			: await prisma.menuItem.create({
					data: {
						name: node.name,
						label: node.label ?? node.name,
						icon: node.icon,
						path: node.path,
						parentId,
						order: node.order,
						isActive: true,
						scope,
					},
				});

	if (node.capabilitySlugs !== undefined) {
		for (const slug of node.capabilitySlugs) {
			const capabilityId = capabilityIds.get(slug);
			if (capabilityId === undefined) {
				continue;
			}
			await prisma.menuItemCapability.upsert({
				where: {
					menuItemId_capabilityId: {
						menuItemId: menuItem.id,
						capabilityId,
					},
				},
				create: {
					menuItemId: menuItem.id,
					capabilityId,
					matchType: node.matchType ?? "ANY",
				},
				update: {
					matchType: node.matchType ?? "ANY",
					isDeleted: false,
					deletedAt: null,
				},
			});
		}
	}

	if (node.children !== undefined) {
		for (const child of node.children) {
			await upsertScopedMenuNode(child, scope, menuItem.id, capabilityIds);
		}
	}

	return menuItem.id;
}

async function seedScopedMenuTree(nodes: readonly ScopedMenuSeedNode[], scope: CapabilityScope, capabilityIds: ReadonlyMap<string, string>): Promise<void> {
	for (const node of nodes) {
		await upsertScopedMenuNode(node, scope, null, capabilityIds);
	}
}

/** Seeds ADMIN + MERCHANT navigation trees linked to `capability_definitions`. */
export async function seedScopedNavigationMenus(): Promise<void> {
	const capabilityIds = await loadCapabilityIds();
	await seedScopedMenuTree(MERCHANT_MENU, "MERCHANT", capabilityIds);
	await seedScopedMenuTree(ADMIN_MENU, "ADMIN", capabilityIds);
}

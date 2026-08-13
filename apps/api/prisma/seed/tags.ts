import type { Tag, User } from "@prisma/client";

import { prisma } from "./client";

export async function createTags(users: User[]): Promise<Tag[]> {
	const get = (email: string) => users.find((u) => u.email === email)!;

	const tagsData = [
		// Alice
		{
			userId: get("alice.johnson@example.com").id,
			name: "marketing",
			color: "#6366f1",
		},
		{
			userId: get("alice.johnson@example.com").id,
			name: "social",
			color: "#ec4899",
		},
		{
			userId: get("alice.johnson@example.com").id,
			name: "docs",
			color: "#10b981",
		},
		{
			userId: get("alice.johnson@example.com").id,
			name: "campaigns",
			color: "#f59e0b",
		},
		// Bob
		{ userId: get("bob.smith@example.com").id, name: "work", color: "#3b82f6" },
		{
			userId: get("bob.smith@example.com").id,
			name: "personal",
			color: "#8b5cf6",
		},
		{
			userId: get("bob.smith@example.com").id,
			name: "portfolio",
			color: "#14b8a6",
		},
		// Carol
		{
			userId: get("carol.white@example.com").id,
			name: "blog",
			color: "#f43f5e",
		},
		{
			userId: get("carol.white@example.com").id,
			name: "recipes",
			color: "#22c55e",
		},
		// David
		{ userId: get("david.lee@example.com").id, name: "dev", color: "#0ea5e9" },
		{
			userId: get("david.lee@example.com").id,
			name: "tools",
			color: "#a855f7",
		},
		{
			userId: get("david.lee@example.com").id,
			name: "open-source",
			color: "#f97316",
		},
		// Frank
		{
			userId: get("frank.miller@example.com").id,
			name: "internal",
			color: "#64748b",
		},
		{
			userId: get("frank.miller@example.com").id,
			name: "ops",
			color: "#dc2626",
		},
		{
			userId: get("frank.miller@example.com").id,
			name: "infra",
			color: "#7c3aed",
		},
		// Grace
		{
			userId: get("grace.wilson@example.com").id,
			name: "art",
			color: "#db2777",
		},
		{
			userId: get("grace.wilson@example.com").id,
			name: "shop",
			color: "#16a34a",
		},
		// Henry
		{
			userId: get("henry.moore@example.com").id,
			name: "finance",
			color: "#ca8a04",
		},
		{
			userId: get("henry.moore@example.com").id,
			name: "news",
			color: "#0891b2",
		},
		{
			userId: get("henry.moore@example.com").id,
			name: "research",
			color: "#9333ea",
		},
		// Isla
		{
			userId: get("isla.taylor@example.com").id,
			name: "travel",
			color: "#0d9488",
		},
		{
			userId: get("isla.taylor@example.com").id,
			name: "photos",
			color: "#e11d48",
		},
		// Jack
		{
			userId: get("jack.anderson@example.com").id,
			name: "saas",
			color: "#2563eb",
		},
		{
			userId: get("jack.anderson@example.com").id,
			name: "startup",
			color: "#7c3aed",
		},
		{
			userId: get("jack.anderson@example.com").id,
			name: "growth",
			color: "#059669",
		},
		// Admin
		{ userId: get("admin@example.com").id, name: "internal", color: "#475569" },
		{
			userId: get("admin@example.com").id,
			name: "monitoring",
			color: "#b91c1c",
		},
	];

	await prisma.tag.createMany({ data: tagsData, skipDuplicates: true });
	return prisma.tag.findMany();
}

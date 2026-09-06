import { z } from "zod";

import { prisma } from "./client";
import { deterministicUuid } from "./deterministic-uuid";

export const CATEGORY_SEED_COUNT = 70;

const DEPARTMENT_NAMES: [
	"Electronics",
	"Apparel",
	"Home & Kitchen",
	"Beauty & Personal Care",
	"Sports & Outdoors",
	"Toys & Games",
	"Books & Media",
	"Automotive",
	"Health & Wellness",
	"Pet Supplies",
	"Office Supplies",
	"Garden & Outdoor",
	"Jewelry & Watches",
	"Baby",
	"Grocery",
] = [
	"Electronics",
	"Apparel",
	"Home & Kitchen",
	"Beauty & Personal Care",
	"Sports & Outdoors",
	"Toys & Games",
	"Books & Media",
	"Automotive",
	"Health & Wellness",
	"Pet Supplies",
	"Office Supplies",
	"Garden & Outdoor",
	"Jewelry & Watches",
	"Baby",
	"Grocery",
];

function departmentNameAt(index: number): string {
	const candidate = DEPARTMENT_NAMES[index % DEPARTMENT_NAMES.length];
	const parsed = z.string().safeParse(candidate);
	return parsed.success ? parsed.data : DEPARTMENT_NAMES[0];
}

export interface SamplePlatformSeedSummary {
	readonly categories: number;
}

export interface CategorySeedRow {
	readonly id: string;
	readonly name: string;
	readonly slug: string;
	readonly description: string;
	readonly sortOrder: number;
	readonly isActive: boolean;
	readonly createdAt: bigint;
	readonly updatedAt: bigint;
}

function seedTimestampMs(daysAgo: number): bigint {
	const millis = Date.now() - daysAgo * 24 * 60 * 60 * 1000;
	return BigInt(millis);
}

function slugify(value: string): string {
	return value
		.toLowerCase()
		.replace(/&/g, "and")
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
}

export function buildCategorySeedId(index: number): string {
	return deterministicUuid("sample-category", String(index));
}

export function buildCategorySeedRows(count: number = CATEGORY_SEED_COUNT): readonly CategorySeedRow[] {
	const seededAt = seedTimestampMs(0);
	return Array.from({ length: count }, (_, index) => {
		const department = departmentNameAt(index);
		const line = Math.floor(index / DEPARTMENT_NAMES.length) + 1;
		const name = line === 1 ? department : `${department} — Collection ${String(line)}`;
		const slug = line === 1 ? slugify(department) : `${slugify(department)}-collection-${String(line)}`;
		return {
			id: buildCategorySeedId(index + 1),
			name,
			slug,
			description: `Curated ${name.toLowerCase()} for the demo storefront.`,
			sortOrder: index + 1,
			isActive: index % 11 !== 0,
			createdAt: seedTimestampMs(90 - index),
			updatedAt: seededAt,
		};
	});
}

export async function seedSamplePlatform(): Promise<SamplePlatformSeedSummary> {
	const categoryRows = buildCategorySeedRows();

	for (const category of categoryRows) {
		await prisma.sampleCategory.upsert({
			where: { id: category.id },
			create: {
				id: category.id,
				name: category.name,
				slug: category.slug,
				description: category.description,
				sortOrder: category.sortOrder,
				isActive: category.isActive,
				createdAt: category.createdAt,
				updatedAt: category.updatedAt,
			},
			update: {
				name: category.name,
				slug: category.slug,
				description: category.description,
				sortOrder: category.sortOrder,
				isActive: category.isActive,
				deletedAt: null,
				updatedAt: category.updatedAt,
			},
		});
	}

	const categories = await prisma.sampleCategory.count({ where: { deletedAt: null } });
	return { categories };
}

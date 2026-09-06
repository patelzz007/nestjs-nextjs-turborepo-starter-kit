import { prisma } from "./client";
import { deterministicUuid } from "./deterministic-uuid";
import { buildCategorySeedId, CATEGORY_SEED_COUNT } from "./sample-platform";

export const PRODUCT_SEED_COUNT = 70;

const BRAND_NAMES: readonly string[] = ["SoundWave", "PulseFit", "EarthWear", "BrewCraft", "DeskNest", "ZenFlow", "NorthPeak", "LumenCo", "UrbanThread", "FreshField"];

export interface ProductSeedSummary {
	readonly products: number;
}

export interface ProductSeedRow {
	readonly id: string;
	readonly sku: string;
	readonly name: string;
	readonly slug: string;
	readonly shortDescription: string;
	readonly description: string;
	readonly price: string;
	readonly compareAtPrice: string | null;
	readonly stockQuantity: number;
	readonly categoryId: string;
	readonly brand: string;
	readonly weightGrams: number;
	readonly imageUrl: string | null;
	readonly isActive: boolean;
	readonly isFeatured: boolean;
	readonly version: number;
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
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
}

export function buildProductSeedId(index: number): string {
	return deterministicUuid("product", String(index));
}

export function buildProductSeedRows(count: number = PRODUCT_SEED_COUNT): readonly ProductSeedRow[] {
	const seededAt = seedTimestampMs(0);
	return Array.from({ length: count }, (_, index) => {
		const sequence = index + 1;
		const name = `Demo Product ${String(sequence).padStart(3, "0")}`;
		const brand = BRAND_NAMES[index % BRAND_NAMES.length];
		const basePrice = 12.99 + (index % 37) * 4.5;
		const hasCompareAt = index % 4 === 0;
		const categoryIndex = index % CATEGORY_SEED_COUNT;
		return {
			id: buildProductSeedId(sequence),
			sku: `SKU-${String(sequence).padStart(4, "0")}`,
			name,
			slug: slugify(name),
			shortDescription: `${brand} demo listing #${String(sequence)} for pagination testing.`,
			description: `Full description for ${name}. Designed for admin list, search, and pagination demos across categories and inventory.`,
			price: basePrice.toFixed(2),
			compareAtPrice: hasCompareAt ? (basePrice + 15).toFixed(2) : null,
			stockQuantity: (index * 7) % 250,
			categoryId: buildCategorySeedId(categoryIndex + 1),
			brand,
			weightGrams: 120 + (index % 40) * 25,
			imageUrl: null,
			isActive: index % 13 !== 0,
			isFeatured: index % 9 === 0,
			version: index % 3,
			createdAt: seedTimestampMs(75 - index),
			updatedAt: seededAt,
		};
	});
}

export async function seedProducts(): Promise<ProductSeedSummary> {
	const productRows = buildProductSeedRows();

	for (const product of productRows) {
		await prisma.product.upsert({
			where: { id: product.id },
			create: {
				id: product.id,
				sku: product.sku,
				name: product.name,
				slug: product.slug,
				shortDescription: product.shortDescription,
				description: product.description,
				price: product.price,
				compareAtPrice: product.compareAtPrice,
				stockQuantity: product.stockQuantity,
				categoryId: product.categoryId,
				brand: product.brand,
				weightGrams: product.weightGrams,
				imageUrl: product.imageUrl,
				isActive: product.isActive,
				isFeatured: product.isFeatured,
				version: product.version,
				createdAt: product.createdAt,
				updatedAt: product.updatedAt,
			},
			update: {
				sku: product.sku,
				name: product.name,
				slug: product.slug,
				shortDescription: product.shortDescription,
				description: product.description,
				price: product.price,
				compareAtPrice: product.compareAtPrice,
				stockQuantity: product.stockQuantity,
				categoryId: product.categoryId,
				brand: product.brand,
				weightGrams: product.weightGrams,
				imageUrl: product.imageUrl,
				isActive: product.isActive,
				isFeatured: product.isFeatured,
				version: product.version,
				deletedAt: null,
				updatedAt: product.updatedAt,
			},
		});
	}

	const products = await prisma.product.count({ where: { deletedAt: null } });
	return { products };
}

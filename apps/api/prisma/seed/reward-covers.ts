// ============================================
// prisma/seed/reward-covers.ts — the cover image of every seeded reward
// ============================================
// Real photos (Unsplash License — see assets/reward-covers/CREDITS.md), 1200×675
// WebP, stored through the configured storage adapter and published exactly as
// an uploaded `REWARD_COVER` is (stored-file-seed-writer.ts). Each cover belongs
// to the organization whose reward shows it and was uploaded by its owner.
// Runs before the rewards are created: a reward cannot exist without its cover.

import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { deterministicUuid } from "./deterministic-uuid";
import { createSeedFileWriter } from "./stored-file-seed-writer";

/** Where the committed cover photos live. */
const COVER_DIRECTORY = join(dirname(fileURLToPath(import.meta.url)), "assets", "reward-covers");

/** How long before the seed run the covers were uploaded. */
const COVER_UPLOADED_DAYS_AGO = 45;

/** The seeded merchant a cover belongs to. */
export type RewardCoverOwner = "kl" | "mlk";

/** Every cover photo, by its file name (`<slug>.webp`) and the organization that uploaded it. */
const REWARD_COVER_OWNERS = {
	"free-coffee": "kl",
	"free-pastry": "kl",
	"weekend-brunch": "kl",
	"matcha-latte": "kl",
	"merdeka-coffee": "kl",
	"dine-in-cashback": "kl",
	"loyalty-points-retail": "kl",
	"signature-noodles": "kl",
	"second-coffee": "kl",
	croissant: "kl",
	"yoga-class": "kl",
	cake: "kl",
	"coffee-refill": "kl",
	"pastry-coffee": "kl",
	"latte-art": "kl",
	"jonker-lunch-set": "mlk",
	"iced-tea": "mlk",
	"weekend-dinner": "mlk",
	"next-meal": "mlk",
	cendol: "mlk",
	"nyonya-kuih": "mlk",
	"live-music-night": "mlk",
	durian: "mlk",
	"heritage-set": "mlk",
	"family-dessert": "mlk",
	"brunch-drink": "mlk",
} satisfies Record<string, RewardCoverOwner>;

export type RewardCoverSlug = keyof typeof REWARD_COVER_OWNERS;

const NAMESPACE = "reward-cover-seed";

/** The stored-file id of a seeded cover — stable across re-seeds, so rewards (and e2e fixtures) can name it. */
export function rewardCoverSeedId(slug: RewardCoverSlug): string {
	return deterministicUuid(NAMESPACE, slug);
}

export interface RewardCoverSeedContext {
	readonly klOrganizationId: string;
	readonly klOwnerUserId: string;
	readonly mlkOrganizationId: string;
	readonly mlkOwnerUserId: string;
}

/** Uploads, publishes and records every cover as a READY `REWARD_COVER` file of its organization; returns how many. */
export async function seedRewardCovers(context: RewardCoverSeedContext): Promise<number> {
	const { seedReadyFile } = createSeedFileWriter();
	const owners: Readonly<Record<RewardCoverOwner, { readonly organizationId: string; readonly userId: string }>> = {
		kl: { organizationId: context.klOrganizationId, userId: context.klOwnerUserId },
		mlk: { organizationId: context.mlkOrganizationId, userId: context.mlkOwnerUserId },
	};
	const entries = Object.entries(REWARD_COVER_OWNERS);
	for (const [slug, ownerKey] of entries) {
		const owner = owners[ownerKey];
		const fileName = `${slug}.webp`;
		await seedReadyFile({
			id: deterministicUuid(NAMESPACE, slug),
			category: "REWARD_COVER",
			ownerId: owner.organizationId,
			fileName,
			mimeType: "image/webp",
			bytes: await readFile(join(COVER_DIRECTORY, fileName)),
			uploadedById: owner.userId,
			organizationId: owner.organizationId,
			uploadedDaysAgo: COVER_UPLOADED_DAYS_AGO,
		});
	}
	return entries.length;
}

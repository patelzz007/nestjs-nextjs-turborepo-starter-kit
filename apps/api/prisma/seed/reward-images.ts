// ============================================
// prisma/seed/reward-images.ts — the images of every seeded reward
// ============================================
// Real photos (Unsplash License — see assets/reward-images/CREDITS.md), 16:9 at
// 4K (3840×2160) WebP, one folder per photo set (`<slug>/01.webp` … — `01` is
// the cover). Each file is stored, checked and rendered exactly as an uploaded
// `REWARD_IMAGE` is (stored-file-seed-writer.ts → the API's ImageRenditionService),
// as a file of the tenant whose rewards show it, uploaded by its owner.
// Rewards are linked to their sets after they are created (`linkRewardImages`).

import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { z } from "zod";

import { mapWithConcurrency } from "../../src/platform/infrastructure/utils/map-with-concurrency";

import { prisma } from "./client";
import { deterministicUuid } from "./deterministic-uuid";
import { createSeedFileWriter } from "./stored-file-seed-writer";

/** Where the committed photos live. */
const IMAGE_DIRECTORY = join(dirname(fileURLToPath(import.meta.url)), "assets", "reward-images");

/**
 * Photos processed at once. Each one is decoded and rendered five times by
 * sharp, whose work runs on libuv's thread pool (4 threads by default): four
 * photos keep every thread busy — about 3.6× faster than one at a time —
 * without queueing a backlog of 4K images in memory.
 */
const SEED_IMAGE_CONCURRENCY = 4;

/** How long before the seed run the images were uploaded. */
const IMAGES_UPLOADED_DAYS_AGO = 45;

/** The seeded merchant a photo set belongs to. */
export type RewardImageOwner = "kl" | "mlk";

/** Every photo set (a folder under assets/reward-images) and the tenant that uploaded it. */
const REWARD_IMAGE_SET_OWNERS = {
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
} satisfies Record<string, RewardImageOwner>;

export type RewardImageSetSlug = keyof typeof REWARD_IMAGE_SET_OWNERS;

/** The committed manifest (written when the photos were sourced): one entry per file, e.g. `nyonya-kuih/02.webp`. */
const ImageManifestSchema = z.array(z.object({ slug: z.string().min(1), file: z.string().regex(/^[a-z0-9-]+\/\d{2}\.webp$/u) }));

const NAMESPACE = "reward-image-seed";

/** The stored-file id of one seeded photo — stable across re-seeds, so e2e fixtures can name it. */
export function rewardImageSeedId(file: string): string {
	return deterministicUuid(NAMESPACE, file);
}

/** The id of a set's cover (`<slug>/01.webp`). */
export function rewardCoverImageSeedId(slug: RewardImageSetSlug): string {
	return rewardImageSeedId(`${slug}/01.webp`);
}

function isSetSlug(value: string): value is RewardImageSetSlug {
	return Object.hasOwn(REWARD_IMAGE_SET_OWNERS, value);
}

/** Every set's files in display order (`01` first). */
async function readImageSets(): Promise<ReadonlyMap<RewardImageSetSlug, readonly string[]>> {
	const manifest = ImageManifestSchema.parse(JSON.parse(await readFile(join(IMAGE_DIRECTORY, "manifest.json"), "utf8")));
	const sets = new Map<RewardImageSetSlug, string[]>();
	for (const entry of manifest) {
		if (!isSetSlug(entry.slug)) {
			throw new Error(`reward-images manifest names an unknown set "${entry.slug}" — add it to REWARD_IMAGE_SET_OWNERS`);
		}
		sets.set(entry.slug, [...(sets.get(entry.slug) ?? []), entry.file].sort());
	}
	return sets;
}

export interface RewardImageSeedContext {
	readonly klTenantId: string;
	readonly klOwnerUserId: string;
	readonly mlkTenantId: string;
	readonly mlkOwnerUserId: string;
}

/** Uploads, checks, renders and publishes every photo as a READY `REWARD_IMAGE` of its tenant; returns how many. */
export async function seedRewardImageFiles(context: RewardImageSeedContext): Promise<number> {
	const { seedReadyFile } = createSeedFileWriter();
	const owners: Readonly<Record<RewardImageOwner, { readonly tenantId: string; readonly userId: string }>> = {
		kl: { tenantId: context.klTenantId, userId: context.klOwnerUserId },
		mlk: { tenantId: context.mlkTenantId, userId: context.mlkOwnerUserId },
	};
	const uploads = [...(await readImageSets())].flatMap(([slug, files]) => files.map((file) => ({ file, owner: owners[REWARD_IMAGE_SET_OWNERS[slug]] })));
	await mapWithConcurrency(uploads, SEED_IMAGE_CONCURRENCY, async ({ file, owner }) =>
		seedReadyFile({
			id: rewardImageSeedId(file),
			category: "REWARD_IMAGE",
			ownerId: owner.tenantId,
			fileName: file.replace("/", "-"),
			mimeType: "image/webp",
			bytes: await readFile(join(IMAGE_DIRECTORY, file)),
			uploadedById: owner.userId,
			tenantId: owner.tenantId,
			uploadedDaysAgo: IMAGES_UPLOADED_DAYS_AGO,
		}),
	);
	return uploads.length;
}

/** A seeded reward and the photo set it shows. */
export interface RewardImageLink {
	readonly rewardId: string;
	readonly tenantId: string;
	readonly slug: RewardImageSetSlug;
}

/** Gives each reward its set's images in display order (position 0 = cover); re-runs converge. */
export async function linkRewardImages(links: readonly RewardImageLink[]): Promise<void> {
	const sets = await readImageSets();
	for (const link of links) {
		const files = sets.get(link.slug);
		if (files === undefined) {
			throw new Error(`No photos for reward image set "${link.slug}" in assets/reward-images`);
		}
		await prisma.rewardImage.deleteMany({ where: { rewardId: link.rewardId } });
		await prisma.rewardImage.createMany({
			data: files.map((file, position) => ({ rewardId: link.rewardId, tenantId: link.tenantId, fileId: rewardImageSeedId(file), position })),
		});
	}
}

/**
 * Image history for one reward: the cover it showed before the owner replaced
 * it, kept as a soft-deleted row (an image row is never hard-deleted in use).
 */
export async function seedReplacedRewardImage(
	link: RewardImageLink & { readonly previousSlug: RewardImageSetSlug; readonly replacedBy: string; readonly replacedAt: bigint },
): Promise<void> {
	await prisma.rewardImage.create({
		data: {
			rewardId: link.rewardId,
			tenantId: link.tenantId,
			fileId: rewardCoverImageSeedId(link.previousSlug),
			position: 0,
			isDeleted: true,
			deletedAt: link.replacedAt,
			deletedBy: link.replacedBy,
			createdAt: link.replacedAt,
			updatedAt: link.replacedAt,
		},
	});
}

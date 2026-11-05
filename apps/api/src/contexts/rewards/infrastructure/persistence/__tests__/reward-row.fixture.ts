import type { Reward } from "@prisma/client";

import { LIVE_ROW_FIELDS } from "../../../../../platform/infrastructure/persistence/__tests__/base-row-fields";

/** A complete reward row as the reward projections select it, shared by the mapper and repository specs. */

export const CREATED_AT_MS = 1_786_300_000_000n;
export const EXPIRY_MS = 1_786_400_000_000n;
export const QUANTITY_TOTAL = 100;
export const LOGO_URL = "https://cdn.example.com/tenants/kopi-co/logo.png";
export const IMAGE_FILE_ID = "5a7d2c11-9e3b-4f6a-8b1c-2d3e4f5a6b7c";
export const SECOND_IMAGE_FILE_ID = "6b8e3d22-0f4c-4a7b-9c2d-3e4f5a6b7c8d";

export function renditionUrl(fileId: string, kind: string): string {
	return `https://cdn.example.com/stores/kopi-co/reward-images/${kind}/${fileId}.webp`;
}

export interface ImageRow {
	readonly fileId: string;
	readonly file: {
		readonly imageWidth: number | null;
		readonly imageHeight: number | null;
		readonly variants: readonly { readonly width: number | null; readonly publicPath: string | null }[];
	};
}

/** A READY 4K image with its renditions, as the repository selects it (ascending width). */
export function imageRow(fileId: string, overrides: Partial<ImageRow["file"]> = {}): ImageRow {
	return {
		fileId,
		file: {
			imageWidth: 3840,
			imageHeight: 2160,
			variants: [
				{ width: 640, publicPath: renditionUrl(fileId, "thumbnail") },
				{ width: 1920, publicPath: renditionUrl(fileId, "large") },
				{ width: 3840, publicPath: renditionUrl(fileId, "uhd") },
			],
			...overrides,
		},
	};
}

export type RewardRow = Reward & { readonly images: readonly ImageRow[] };

/** A complete reward row; each case overrides only what it is about. */
export function buildRewardRow(overrides: Partial<RewardRow> = {}): RewardRow {
	return {
		...LIVE_ROW_FIELDS,
		id: "7f1c1b9e-8a43-4c2e-9d1a-3b7e6f2a9c01",
		tenantId: "0b6a3c55-2f1d-4e8a-a7b9-5c4d3e2f1a10",
		title: "Free coffee",
		description: "One free coffee",
		rewardType: "FREE_ITEM",
		rewardValue: 1,
		freeItemName: "Coffee",
		freeItemSku: "BEV-COFFEE",
		termsConditions: null,
		rewardKind: "CONSUMER",
		category: "cafe",
		images: [imageRow(IMAGE_FILE_ID)],
		rules: null,
		minSpendMinor: null,
		quantityTotal: QUANTITY_TOTAL,
		quantityRemaining: QUANTITY_TOTAL,
		quantityReserved: 0,
		startDate: null,
		expiryDate: EXPIRY_MS,
		status: "PUBLISHED",
		claimCount: 0,
		redemptionCount: 0,
		metadata: null,
		referralsEnabled: false,
		referralPoolTotal: null,
		referralPoolRemaining: null,
		referrerRewardId: null,
		parentConsumerRewardId: null,
		locationScopeType: "ALL_LOCATIONS",
		audienceType: "EVERYONE",
		submittedForReviewAt: null,
		autoPublishAt: null,
		reviewedAt: null,
		reviewedByUserId: null,
		rejectionReason: null,
		isDeleted: false,
		deletedAt: null,
		createdAt: CREATED_AT_MS,
		updatedAt: CREATED_AT_MS,
		...overrides,
	};
}

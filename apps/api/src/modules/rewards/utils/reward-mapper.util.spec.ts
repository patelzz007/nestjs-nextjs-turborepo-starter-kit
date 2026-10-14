import type { Reward } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { RewardResponseSchema } from "@workspace/shared";

import { mapRewardImages, mapRewardToResponse, resolveOrganizationLogoUrl, RewardImageUnavailableError, type RewardOrganizationSummary } from "./reward-mapper.util";
import { TEST_RESOLVE_PUBLIC_URL } from "../../../../test/support/public-urls";
import { createTestTypedConfig } from "../../../../test/support/test-api-env";

const CREATED_AT_MS = 1_786_300_000_000n;
const EXPIRY_MS = 1_786_400_000_000n;
const QUANTITY_TOTAL = 100;
const LOGO_URL = "https://cdn.example.com/organizations/kopi-co/logo.png";
const IMAGE_FILE_ID = "5a7d2c11-9e3b-4f6a-8b1c-2d3e4f5a6b7c";
const SECOND_IMAGE_FILE_ID = "6b8e3d22-0f4c-4a7b-9c2d-3e4f5a6b7c8d";

function renditionUrl(fileId: string, kind: string): string {
	return `https://cdn.example.com/stores/kopi-co/reward-images/${kind}/${fileId}.webp`;
}

interface ImageRow {
	readonly fileId: string;
	readonly file: {
		readonly imageWidth: number | null;
		readonly imageHeight: number | null;
		readonly variants: readonly { readonly width: number | null; readonly publicPath: string | null }[];
	};
}

/** A READY 4K image with its renditions, as the repository selects it (ascending width). */
function imageRow(fileId: string, overrides: Partial<ImageRow["file"]> = {}): ImageRow {
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

type RewardRow = Reward & { readonly images: readonly ImageRow[] };

/** A complete reward row; each case overrides only what it is about. */
function buildRewardRow(overrides: Partial<RewardRow> = {}): RewardRow {
	return {
		id: "7f1c1b9e-8a43-4c2e-9d1a-3b7e6f2a9c01",
		organizationId: "0b6a3c55-2f1d-4e8a-a7b9-5c4d3e2f1a10",
		title: "Free coffee",
		description: "One free coffee",
		rewardType: "FREE_ITEM",
		rewardValue: 0,
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

const LOGO_FILE_ID = "6b0f2d1c-3e4a-4b5c-8d9e-0f1a2b3c4d5e";
const LOGO_THUMBNAIL_URL = "https://cdn.example.com/stores/kopi-co/logo/thumbnail/logo.webp";
const LOGO_MEDIUM_URL = "https://cdn.example.com/stores/kopi-co/logo/medium/logo.webp";
const LOGO_RENDITIONS = [
	{ width: 128, publicPath: LOGO_THUMBNAIL_URL },
	{ width: 256, publicPath: LOGO_MEDIUM_URL },
];

function organization(publicPaths: readonly (string | null)[]): RewardOrganizationSummary {
	return { displayName: "Kopi Co", assets: publicPaths.map((publicPath) => ({ fileId: LOGO_FILE_ID, file: { publicPath, variants: LOGO_RENDITIONS } })) };
}

describe("resolveOrganizationLogoUrl", () => {
	it("returns the logo's public URL when the organization has a READY logo", () => {
		expect(resolveOrganizationLogoUrl(organization([LOGO_URL]), TEST_RESOLVE_PUBLIC_URL)).toBe(LOGO_URL);
	});

	it("returns null when the organization has no logo asset", () => {
		expect(resolveOrganizationLogoUrl(organization([]), TEST_RESOLVE_PUBLIC_URL)).toBeNull();
	});

	it("returns null when the logo file has no public URL yet", () => {
		expect(resolveOrganizationLogoUrl(organization([null]), TEST_RESOLVE_PUBLIC_URL)).toBeNull();
	});

	it("returns null when no organization was loaded", () => {
		expect(resolveOrganizationLogoUrl(undefined, TEST_RESOLVE_PUBLIC_URL)).toBeNull();
	});

	it("degrades a stored value that breaks the contract to null instead of failing the response", () => {
		expect(resolveOrganizationLogoUrl(organization(["organizations/kopi-co/logo.png"]), TEST_RESOLVE_PUBLIC_URL)).toBeNull();
		expect(resolveOrganizationLogoUrl(organization(["javascript:alert(1)"]), TEST_RESOLVE_PUBLIC_URL)).toBeNull();
	});
});

describe("mapRewardToResponse merchant identity", () => {
	it("carries the merchant name, logo URL and the logo's renditions, and satisfies the response contract", () => {
		const response = mapRewardToResponse(buildRewardRow(), organization([LOGO_URL]), TEST_RESOLVE_PUBLIC_URL);

		expect(response.organizationName).toBe("Kopi Co");
		expect(response.organizationLogoUrl).toBe(LOGO_URL);
		expect(response.organizationLogoSources).toEqual([
			{ width: 128, url: LOGO_THUMBNAIL_URL },
			{ width: 256, url: LOGO_MEDIUM_URL },
		]);
		expect(RewardResponseSchema.safeParse(response).success).toBe(true);
	});

	it("sends an explicit null logo (monogram fallback) and no renditions when the merchant has none", () => {
		const response = mapRewardToResponse(buildRewardRow(), organization([]), TEST_RESOLVE_PUBLIC_URL);

		expect(response.organizationLogoUrl).toBeNull();
		expect(response.organizationLogoSources).toEqual([]);
		expect(RewardResponseSchema.safeParse(response).success).toBe(true);
	});

	it("sends a null logo when the reward is mapped without its organization", () => {
		const response = mapRewardToResponse(buildRewardRow(), undefined, TEST_RESOLVE_PUBLIC_URL);

		expect(response.organizationName).toBeUndefined();
		expect(response.organizationLogoUrl).toBeNull();
	});
});

describe("mapRewardToResponse logo renditions", () => {
	it("serves no renditions for a logo whose own URL the contract rejects (no logo is shown)", () => {
		const response = mapRewardToResponse(buildRewardRow(), organization(["javascript:alert(1)"]), TEST_RESOLVE_PUBLIC_URL);

		expect(response.organizationLogoUrl).toBeNull();
		expect(response.organizationLogoSources).toEqual([]);
	});
});

describe("reward images", () => {
	it("joins images saved by the local driver (paths on this API) to the API's public address", () => {
		const { publicUrl } = createTestTypedConfig().http;
		const localPath = `/api/v1/files/${IMAGE_FILE_ID}/variants/THUMBNAIL/local-public`;
		const [image] = mapRewardImages({ id: "r", images: [imageRow(IMAGE_FILE_ID, { variants: [{ width: 640, publicPath: localPath }] })] }, TEST_RESOLVE_PUBLIC_URL);

		expect(image?.url).toBe(`${publicUrl}${localPath}`);
		expect(image?.sources).toEqual([{ width: 640, url: `${publicUrl}${localPath}` }]);
	});

	it("carries every image in display order, each with its renditions for srcset and the largest as its url", () => {
		const response = mapRewardToResponse(buildRewardRow({ images: [imageRow(IMAGE_FILE_ID), imageRow(SECOND_IMAGE_FILE_ID)] }), organization([]), TEST_RESOLVE_PUBLIC_URL);

		expect(response.images.map((image) => image.fileId)).toEqual([IMAGE_FILE_ID, SECOND_IMAGE_FILE_ID]);
		const [cover] = response.images;
		expect(cover).toEqual({
			fileId: IMAGE_FILE_ID,
			url: renditionUrl(IMAGE_FILE_ID, "uhd"),
			width: 3840,
			height: 2160,
			sources: [
				{ width: 640, url: renditionUrl(IMAGE_FILE_ID, "thumbnail") },
				{ width: 1920, url: renditionUrl(IMAGE_FILE_ID, "large") },
				{ width: 3840, url: renditionUrl(IMAGE_FILE_ID, "uhd") },
			],
		});
		expect(RewardResponseSchema.safeParse(response).success).toBe(true);
	});

	it("leaves out a rendition that was never published", () => {
		const [image] = mapRewardImages(
			{
				id: "r",
				images: [
					imageRow(IMAGE_FILE_ID, {
						variants: [
							{ width: 640, publicPath: null },
							{ width: 3840, publicPath: renditionUrl(IMAGE_FILE_ID, "uhd") },
						],
					}),
				],
			},
			TEST_RESOLVE_PUBLIC_URL,
		);

		expect(image?.sources).toEqual([{ width: 3840, url: renditionUrl(IMAGE_FILE_ID, "uhd") }]);
	});

	it("fails loudly on a broken invariant — no images, no renditions, no size or an unsafe URL — never a silent blank", () => {
		expect(() => mapRewardImages({ id: "r", images: [] }, TEST_RESOLVE_PUBLIC_URL)).toThrow(RewardImageUnavailableError);
		expect(() => mapRewardImages({ id: "r", images: [imageRow(IMAGE_FILE_ID, { variants: [] })] }, TEST_RESOLVE_PUBLIC_URL)).toThrow(RewardImageUnavailableError);
		expect(() => mapRewardImages({ id: "r", images: [imageRow(IMAGE_FILE_ID, { imageWidth: null })] }, TEST_RESOLVE_PUBLIC_URL)).toThrow(RewardImageUnavailableError);
		expect(() =>
			mapRewardImages({ id: "r", images: [imageRow(IMAGE_FILE_ID, { variants: [{ width: 640, publicPath: "javascript:alert(1)" }] })] }, TEST_RESOLVE_PUBLIC_URL),
		).toThrow(RewardImageUnavailableError);
	});
});

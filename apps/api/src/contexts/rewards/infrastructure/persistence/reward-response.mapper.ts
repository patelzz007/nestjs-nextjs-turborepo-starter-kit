import type { Reward } from "@prisma/client";

import {
	EpochMsSchema,
	RewardImageResponseSchema,
	RewardResponseSchema,
	type EpochMs,
	type ImageSource,
	type RewardImageResponse,
	type RewardResponse,
} from "@workspace/shared";

import type { PublicUrlResolve } from "../../../../config/public-url.resolver";
import { RewardRulesValue } from "../../domain/value-objects/reward-rules.value-object";
import { storedRulesJson } from "./reward.mapper";
import { toImageSources } from "../../../files/public-api";

function epochFromDb(value: bigint | number | null | undefined): EpochMs | null {
	if (value === null || value === undefined) {
		return null;
	}
	return EpochMsSchema.parse(Number(value));
}

function epochRequired(value: bigint | number): EpochMs {
	return EpochMsSchema.parse(Number(value));
}

interface RewardLocationScopeRow {
	readonly locationId: string;
	readonly location: { readonly name: string } | null;
}

/** One live reward image as the repositories select it: its file's size and published renditions (ascending width). */
interface RewardImageRow {
	readonly fileId: string;
	readonly file: {
		readonly imageWidth: number | null;
		readonly imageHeight: number | null;
		readonly variants: readonly { readonly width: number | null; readonly publicPath: string | null }[];
	};
}

/** Fields the public reward response reads. A marketplace query selects these and nothing else. */
export type RewardResponseSource = Pick<
	Reward,
	| "id"
	| "tenantId"
	| "title"
	| "description"
	| "rewardType"
	| "rewardValue"
	| "termsConditions"
	| "rewardKind"
	| "category"
	| "rules"
	| "minSpendMinor"
	| "quantityTotal"
	| "quantityRemaining"
	| "quantityReserved"
	| "startDate"
	| "expiryDate"
	| "status"
	| "claimCount"
	| "redemptionCount"
	| "referralsEnabled"
	| "referralPoolTotal"
	| "referralPoolRemaining"
	| "referrerRewardId"
	| "locationScopeType"
	| "createdAt"
	| "updatedAt"
	| "isDeleted"
	| "deletedAt"
> & {
	readonly locationScopes?: readonly RewardLocationScopeRow[];
	/** The live images in display order — every reward query that builds a response selects them. */
	readonly images: readonly RewardImageRow[];
};

/**
 * A reward image has no recorded size or published renditions — impossible
 * while saves only accept READY images (renditions commit with READY) and
 * images in use cannot be deleted.
 */
export class RewardImageUnavailableError extends Error {
	public constructor(
		public readonly rewardId: string,
		public readonly fileId: string | null,
	) {
		super(fileId === null ? `Reward ${rewardId} has no images` : `Reward ${rewardId} image ${fileId} has no published renditions`);
		this.name = "RewardImageUnavailableError";
	}
}

/**
 * The response shape of one reward image, re-checked against the contract
 * (http(s) URLs). A broken invariant fails loudly instead of sending a blank image.
 */
export function mapRewardImage(rewardId: string, image: RewardImageRow, resolve: PublicUrlResolve): RewardImageResponse {
	const sources = toImageSources(image.file.variants, resolve);
	const largest = sources.at(-1);
	const parsed = RewardImageResponseSchema.safeParse({
		fileId: image.fileId,
		url: largest?.url,
		width: image.file.imageWidth,
		height: image.file.imageHeight,
		sources,
	});
	if (!parsed.success) {
		throw new RewardImageUnavailableError(rewardId, image.fileId);
	}
	return parsed.data;
}

/** All of a reward's images, in display order; a reward without any is a broken invariant. */
export function mapRewardImages(reward: Pick<RewardResponseSource, "id" | "images">, resolve: PublicUrlResolve): RewardImageResponse[] {
	if (reward.images.length === 0) {
		throw new RewardImageUnavailableError(reward.id, null);
	}
	return reward.images.map((image) => mapRewardImage(reward.id, image, resolve));
}

/** The merchant's name and logo a reward response shows (from the tenants context, batched per page). */
export interface RewardTenantDisplay {
	readonly displayName: string;
	/** The logo's public URL, or null (clients render a name monogram). */
	readonly logoUrl: string | null;
	/** The logo's renditions, smallest first; empty without a logo. */
	readonly logoSources: readonly ImageSource[];
}

/** The response contract's own rule for a logo URL — the value is re-checked against it. */
const TenantLogoUrlSchema = RewardResponseSchema.shape.tenantLogoUrl;

/**
 * The merchant logo URL for a reward response, or `null`. A value that does not satisfy the
 * contract (not an absolute http(s) URL) degrades to `null`, deliberately: a bad logo must cost
 * the merchant their logo, not fail the whole reward list.
 */
export function rewardLogoUrl(tenant: RewardTenantDisplay | undefined): string | null {
	const logoUrl = tenant?.logoUrl ?? null;
	if (logoUrl === null) {
		return null;
	}
	const parsed = TenantLogoUrlSchema.safeParse(logoUrl);
	return parsed.success ? parsed.data : null;
}

/**
 * A reward as the API returns it. `resolve` turns each stored image reference
 * (its photos, the merchant logo) into the URL a client opens.
 */
export function mapRewardToResponse(reward: RewardResponseSource, tenant: RewardTenantDisplay | undefined, resolve: PublicUrlResolve): RewardResponse {
	const locationScopes = reward.locationScopes ?? [];
	const resolvedScopes = locationScopes.flatMap((scope) => {
		if (scope.location === null) {
			return [];
		}

		return [{ locationId: scope.locationId, name: scope.location.name }];
	});
	const locationIds = resolvedScopes.map((scope) => scope.locationId);
	const locationNames = resolvedScopes.map((scope) => scope.name);
	const logoUrl = rewardLogoUrl(tenant);

	return {
		id: reward.id,
		tenantId: reward.tenantId,
		tenantName: tenant?.displayName,
		tenantLogoUrl: logoUrl,
		// The logo's renditions go with its URL: no logo, no sources.
		tenantLogoSources: logoUrl === null || tenant === undefined ? [] : [...tenant.logoSources],
		title: reward.title,
		description: reward.description,
		rewardType: reward.rewardType,
		rewardValue: reward.rewardValue,
		termsConditions: reward.termsConditions,
		rewardKind: reward.rewardKind,
		category: reward.category,
		images: mapRewardImages(reward, resolve),
		quantityTotal: reward.quantityTotal,
		quantityRemaining: reward.quantityRemaining,
		quantityReserved: reward.quantityReserved,
		startDate: epochFromDb(reward.startDate),
		expiryDate: epochRequired(reward.expiryDate),
		status: reward.status,
		claimCount: reward.claimCount,
		redemptionCount: reward.redemptionCount,
		referralsEnabled: reward.referralsEnabled,
		referralPoolTotal: reward.referralPoolTotal,
		referralPoolRemaining: reward.referralPoolRemaining,
		referrerRewardId: reward.referrerRewardId,
		rules: RewardRulesValue.fromStorage(storedRulesJson(reward.rules), reward.minSpendMinor).toApi(),
		locationScopeType: reward.locationScopeType,
		locationIds,
		locationNames: locationNames.length > 0 ? locationNames : undefined,
		createdAt: epochRequired(reward.createdAt),
		updatedAt: epochRequired(reward.updatedAt),
		isDeleted: reward.isDeleted,
		deletedAt: epochFromDb(reward.deletedAt),
	};
}

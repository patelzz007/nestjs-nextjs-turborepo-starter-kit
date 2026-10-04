import { testEnvelope } from "@/test-support/envelope";
import { ApiPaginatedMetaSchema, RewardClaimResponseSchema, type Envelope, type RewardClaimResponse, type RewardClaimStatus } from "@workspace/shared";

const FIXTURE_NOW_MS = 1_790_000_000_000;
const FIXTURE_CLAIM_TTL_MS = 7 * 86_400_000;

export interface RewardClaimFixtureOverrides {
	readonly id?: string;
	readonly rewardTitle?: string;
	readonly status?: RewardClaimStatus;
}

/** A complete, schema-valid claim of the signed-in user; `overrides` set only what a case is about. */
export function buildRewardClaimResponse(overrides: RewardClaimFixtureOverrides = {}): RewardClaimResponse {
	return RewardClaimResponseSchema.parse({
		id: "00000000-0000-4000-8000-0000000000c1",
		rewardId: "00000000-0000-4000-8000-000000000001",
		rewardTitle: "Free coffee",
		status: "PENDING",
		claimedAt: FIXTURE_NOW_MS,
		claimExpiresAt: FIXTURE_NOW_MS + FIXTURE_CLAIM_TTL_MS,
		redeemedAt: null,
		isReferrerCredit: false,
		createdAt: FIXTURE_NOW_MS,
		updatedAt: FIXTURE_NOW_MS,
		isDeleted: false,
		deletedAt: null,
		...overrides,
	});
}

export interface ClaimsPageFixture {
	readonly claims: readonly RewardClaimResponse[];
	/** Every claim matching the query across all pages — what the server counts. */
	readonly total: number;
	readonly page?: number;
	readonly limit: number;
	readonly nextCursor?: string | null;
}

/** A `GET /claims` response envelope with real pagination meta. */
export function claimsPageEnvelope({ claims, total, page = 1, limit, nextCursor = null }: ClaimsPageFixture): Envelope<RewardClaimResponse[]> {
	const totalPages = Math.max(1, Math.ceil(total / limit));
	return testEnvelope(
		[...claims],
		ApiPaginatedMetaSchema.parse({
			correlationId: "",
			timestamp: FIXTURE_NOW_MS,
			limit,
			total,
			page,
			totalPages,
			nextCursor,
			hasNext: page < totalPages,
			hasPrevious: page > 1,
		}),
	);
}

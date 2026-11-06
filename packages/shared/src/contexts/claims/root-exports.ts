// What the root `@workspace/shared` barrel exposes of the `claims` context (enhancement 8.2): a curated subset of
// this context's index. Its own contract object and route map stay behind the aggregated `apiContract` /
// `apiRoutes`, and its building-block schemas stay internal. Add a name here to make it part of the package's
// public surface (the export snapshot in src/contracts/__tests__/api-contract-shape.test.ts records it).

export {
	CreateRewardClaimSchema,
	RequestClaimOtpResponseSchema,
	RequestClaimOtpSchema,
	RewardClaimCreatedResponseSchema,
	RewardClaimListQuerySchema,
	rewardClaimListQuery,
	RewardClaimQrResponseSchema,
	RewardClaimResponseSchema,
} from "./schemas/claim";
export { RewardBackupCodeSchema, RewardClaimStatusSchema, RewardOtpPurposeSchema } from "./schemas/claim-enums";
export { getRewardClaimBlockReason, isRewardClaimable, rewardClaimBlockMessage, type RewardClaimBlockReason } from "./schemas/claim-availability";
export type {
	CreateRewardClaimInput,
	RequestClaimOtpInput,
	RequestClaimOtpResponse,
	RewardClaimCreatedResponse,
	RewardClaimListQuery,
	RewardClaimListSortField,
	RewardClaimQrResponse,
	RewardClaimResponse,
} from "./schemas/claim";
export type { RewardBackupCode, RewardClaimStatus, RewardOtpPurpose } from "./schemas/claim-enums";

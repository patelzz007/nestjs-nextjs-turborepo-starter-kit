// What the root `@workspace/shared` barrel exposes of the `referrals` context (enhancement 8.2): a curated subset of
// this context's index. Its own contract object and route map stay behind the aggregated `apiContract` /
// `apiRoutes`, and its building-block schemas stay internal. Add a name here to make it part of the package's
// public surface (the export snapshot in src/contracts/__tests__/api-contract-shape.test.ts records it).

export { SIGNUP_REFERRAL_CODE_ALPHABET, SIGNUP_REFERRAL_CODE_LENGTH, SIGNUP_REFERRAL_CODE_TTL_MS, SIGNUP_REFERRALS_SCREEN_PATH } from "./schemas/signup-referral.constants";
export {
	AdminSignupReferralStatusFilterSchema,
	AdminSignupReferrerSummarySchema,
	SignupReferralCodeInputSchema,
	SignupReferralCodeStateSchema,
	SignupReferralDashboardSchema,
	SignupReferralErrorCodeSchema,
	SignupReferralRefereeItemSchema,
	SignupReferralRefereeListQuerySchema,
	SignupReferralStatusSchema,
	signupReferralRefereeListQuery,
} from "./schemas/signup-referrals";
export type {
	AdminSignupReferralStatusFilter,
	AdminSignupReferrerSummary,
	SignupReferralCodeState,
	SignupReferralDashboard,
	SignupReferralErrorCode,
	SignupReferralRefereeItem,
	SignupReferralRefereeListQuery,
	SignupReferralStatus,
} from "./schemas/signup-referrals";
export { RewardReferralStatusSchema } from "./schemas/referral-enums";
export {
	REWARD_REFERRAL_ATTRIBUTION_TTL_DAYS,
	REWARD_REFERRAL_OPEN_LINK_LIMIT,
	REWARD_REFERRAL_QUERY_PARAM,
	RewardReferralAttributionResponseSchema,
	RewardReferralAttributionSchema,
	RewardReferralAttributionTokenSchema,
	RewardReferralLinkResponseSchema,
} from "./schemas/reward-referrals";
export type { RewardReferralStatus } from "./schemas/referral-enums";
export type {
	RewardReferralAttributionInput,
	RewardReferralAttributionResponse,
	RewardReferralAttributionToken,
	RewardReferralLinkResponse,
} from "./schemas/reward-referrals";

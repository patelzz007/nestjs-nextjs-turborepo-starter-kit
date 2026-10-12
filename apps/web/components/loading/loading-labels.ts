import type { UiKitLabelsOverride } from "@workspace/ui/lib/labels/ui-kit-labels";

/*
 * What each web loading surface announces to screen readers. Module
 * constants, so every render hands `SkeletonRegion` the same object.
 */

type SkeletonRegionLabels = UiKitLabelsOverride<"skeletonRegion">;

export const LANDING_LOADING_LABELS: SkeletonRegionLabels = { loading: "Loading offers near you…" };
export const REWARDS_CATALOG_LOADING_LABELS: SkeletonRegionLabels = { loading: "Loading offers…" };
export const REWARD_DETAIL_LOADING_LABELS: SkeletonRegionLabels = { loading: "Loading reward…" };
export const CLAIM_OPTIONS_LOADING_LABELS: SkeletonRegionLabels = { loading: "Loading claim options…" };
export const WALLET_LOADING_LABELS: SkeletonRegionLabels = { loading: "Loading your rewards…" };
export const WALLET_CLAIMS_LOADING_LABELS: SkeletonRegionLabels = { loading: "Loading claims…" };
export const CLAIM_QR_LOADING_LABELS: SkeletonRegionLabels = { loading: "Loading redemption code…" };
export const REFERRALS_LOADING_LABELS: SkeletonRegionLabels = { loading: "Loading referrals…" };
export const REFERRAL_CODE_LOADING_LABELS: SkeletonRegionLabels = { loading: "Loading your code…" };
export const REFEREES_LOADING_LABELS: SkeletonRegionLabels = { loading: "Loading people who used your code…" };
export const ACTIVITY_LOADING_LABELS: SkeletonRegionLabels = { loading: "Loading your activity…" };
export const ACCOUNT_SETTINGS_LOADING_LABELS: SkeletonRegionLabels = { loading: "Loading account settings…" };
export const PROFILE_LOADING_LABELS: SkeletonRegionLabels = { loading: "Loading your profile…" };
export const PROFILE_EMAIL_LOADING_LABELS: SkeletonRegionLabels = { loading: "Loading your email…" };
export const SIGN_IN_LOADING_LABELS: SkeletonRegionLabels = { loading: "Loading sign-in…" };
export const RESET_PASSWORD_LOADING_LABELS: SkeletonRegionLabels = { loading: "Loading password reset…" };
export const VERIFY_EMAIL_LOADING_LABELS: SkeletonRegionLabels = { loading: "Loading email verification…" };
export const IMPERSONATION_USERS_LOADING_LABELS: SkeletonRegionLabels = { loading: "Loading users…" };

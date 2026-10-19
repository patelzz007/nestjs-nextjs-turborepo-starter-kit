import { listStateToListQuery } from "@workspace/client/lib/api/list-query";
import { listUrlParams } from "@workspace/client/lib/url-state/list-url-state";
import { defineUrlState } from "@workspace/client/lib/url-state/url-state";
import { signupReferralRefereeListQuery, SignupReferralRefereeListQuerySchema, type SignupReferralRefereeListQuery } from "@workspace/shared";

export const SIGNUP_REFERRALS_DASHBOARD_PREFETCH_KEY = "signup-referrals-dashboard";

export const SIGNUP_REFERRALS_PAGE_SIZE_OPTIONS: readonly number[] = [10, 20, 50];
export const SIGNUP_REFERRALS_DEFAULT_PAGE_SIZE = 10;

export const SIGNUP_REFERRALS_REFEREES_URL_STATE = defineUrlState({
	...listUrlParams(signupReferralRefereeListQuery, { pageSizes: SIGNUP_REFERRALS_PAGE_SIZE_OPTIONS, defaultLimit: SIGNUP_REFERRALS_DEFAULT_PAGE_SIZE }),
});

export type SignupReferralsRefereesUrlState = typeof SIGNUP_REFERRALS_REFEREES_URL_STATE.defaults;

/** The `GET /auth/signup-referrals/referees` input for a URL state (the endpoint takes no filters or search). */
export function toSignupReferralRefereesQuery(state: SignupReferralsRefereesUrlState): SignupReferralRefereeListQuery {
	return SignupReferralRefereeListQuerySchema.parse(listStateToListQuery(signupReferralRefereeListQuery, { pagination: state, sort: state.sort }));
}

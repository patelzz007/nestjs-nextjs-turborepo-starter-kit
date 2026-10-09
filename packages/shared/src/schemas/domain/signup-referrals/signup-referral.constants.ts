import { DAY_MS } from "../rewards/analytics";

/** Referral codes are valid for this many milliseconds from row creation (ADR 035). */
export const SIGNUP_REFERRAL_CODE_TTL_MS: number = 30 * DAY_MS;

/** Stored code length (ADR 035). */
export const SIGNUP_REFERRAL_CODE_LENGTH = 8;

/** Alphabet without look-alike characters (ADR 035). */
export const SIGNUP_REFERRAL_CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

/** The consumer web screen the referrer's success notification links to (ADR 035, "Notification"). */
export const SIGNUP_REFERRALS_SCREEN_PATH = "/rewardhub/referrals";

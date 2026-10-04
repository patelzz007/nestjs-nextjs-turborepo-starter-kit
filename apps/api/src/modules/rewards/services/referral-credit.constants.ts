import { DAY_MS } from "@workspace/shared";

/** A referrer's credit claim stays redeemable this long (capped by the referrer reward's own expiry). */
export const REFERRER_CLAIM_TTL_DAYS = 30;

export const REFERRER_CLAIM_TTL_MS = REFERRER_CLAIM_TTL_DAYS * DAY_MS;

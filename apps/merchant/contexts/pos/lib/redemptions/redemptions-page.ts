/**
 * Rows on the redemptions page. The server prefetch and the client query must
 * use the same value: it is part of the list query key, so a mismatch would
 * cache the server's rows under a key that asks for a different page size.
 */
export const MERCHANT_REDEMPTIONS_PAGE_SIZE = 20;

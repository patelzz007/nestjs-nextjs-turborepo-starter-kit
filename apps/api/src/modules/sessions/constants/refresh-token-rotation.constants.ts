/**
 * Grace window after a refresh-token rotation during which presenting the
 * IMMEDIATE predecessor of the current token (the one whose hash is stored in
 * `previousTokenHash`) is treated as a benign concurrent refresh
 * (`REFRESH_TOKEN_SUPERSEDED`) instead of token theft.
 *
 * Any other non-current token of the same session — or the predecessor
 * presented after this window — is reuse, and revokes every session of the
 * user. Single source for `SessionsService` and `RefreshTokenRepository`.
 */
export const REFRESH_SUPERSEDED_GRACE_MS = 30_000;

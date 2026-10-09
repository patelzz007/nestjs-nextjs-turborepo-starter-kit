// ============================================
// body-token-contract.ts - the wire shapes of the body token transport
// ============================================
// For client type `mobile` (ADR 029), `POST /auth/refresh` takes the refresh
// token in the request body (`RefreshTokenBodySchema`) and answers the rotated
// pair in the response body, inside the standard success envelope (ADR 022) —
// `RefreshMobileResponseSchema`. Every shape comes from the API contract in
// @workspace/shared; this module only derives what the client stores and parses.
// Response schemas are open (never `.strict()`), so a field the API adds later
// never breaks an installed app.

import { BodyTokenFieldsSchema, createApiSuccessEnvelopeSchema, RefreshMobileResponseSchema } from "@workspace/shared";
import { z } from "zod";

/**
 * The token pair a mobile login or refresh answers with, and what a
 * `TokenProvider` stores: the two tokens of the shared body-token fields
 * (bounded by `ACCESS_TOKEN_MAX_LENGTH` / `REFRESH_TOKEN_MAX_LENGTH`).
 */
export const BodyTokenPairSchema = BodyTokenFieldsSchema.pick({ accessToken: true, refreshToken: true });

export type BodyTokenPair = z.output<typeof BodyTokenPairSchema>;

/** Success envelope of `POST /auth/refresh` for the mobile client type. */
export const BodyTokenRefreshResponseSchema = createApiSuccessEnvelopeSchema(RefreshMobileResponseSchema);

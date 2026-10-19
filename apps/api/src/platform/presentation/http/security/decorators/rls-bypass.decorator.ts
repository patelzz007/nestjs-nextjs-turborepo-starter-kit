import { SetMetadata } from "@nestjs/common";

/** Metadata key read by `RlsInterceptor` to enable `app.rls_bypass` for the request. */
export const RLS_BYPASS_KEY = "rlsBypass";

/**
 * Opts a handler into Postgres RLS bypass (`app.rls_bypass = true`) for the
 * request scope. Use on **public** routes that must read or write across tenant
 * boundaries (signup/login, signed webhooks), and on privileged session flows
 * that run under an impersonation JWT (`POST /auth/stop-impersonation`).
 * Do **not** combine with session refresh/logout — those routes have
 * `request.user` from the refresh token and should stay scoped to `sub`.
 *
 * `@Public()` only skips JWT auth; it does **not** imply RLS bypass.
 */
export const RlsBypass = (): ReturnType<typeof SetMetadata> => SetMetadata(RLS_BYPASS_KEY, true);

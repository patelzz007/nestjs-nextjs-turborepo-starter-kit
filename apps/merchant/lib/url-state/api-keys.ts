// Which keys the API-keys page shows is a view filter on the page: shareable,
// refresh-safe and undone by Back, so it lives in the URL (ADR 023,
// docs/list-queries.md §7). It filters the keys the page already loaded — the
// headline counts need active AND revoked keys — so it is not an API filter, and
// the server prefetch does not depend on it.

import { defineUrlState, urlParamWithDefault } from "@workspace/client/lib/url-state/url-state";

import { ApiKeyFilterSchema, DEFAULT_API_KEY_FILTER } from "@/lib/api-keys/api-key-summary";

/** `/orgs/[orgSlug]/api-keys?status=revoked|all` — absent means active keys. */
export const API_KEYS_URL_STATE = defineUrlState({ status: urlParamWithDefault(ApiKeyFilterSchema, DEFAULT_API_KEY_FILTER) });

export type ApiKeysUrlState = typeof API_KEYS_URL_STATE.defaults;

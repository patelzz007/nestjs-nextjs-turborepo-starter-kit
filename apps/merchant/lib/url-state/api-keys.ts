// Which keys the API-keys page shows is a view filter on the page: shareable,
// refresh-safe and undone by Back, so it lives in the URL (ADR 023,
// docs/technical/api/list-queries.md §7). It maps 1:1 onto the API's
// `filter[revokedAt][isNull]` (`toApiKeyListQuery`), so the list and its total
// cover every matching key; the server page parses it to prefetch that view.

import { defineUrlState, urlParamWithDefault } from "@workspace/client/lib/url-state/url-state";

import { ApiKeyFilterSchema, DEFAULT_API_KEY_FILTER } from "@/lib/api-keys/api-key-summary";

/** `/orgs/[orgSlug]/api-keys?status=revoked|all` — absent means active keys. */
export const API_KEYS_URL_STATE = defineUrlState({ status: urlParamWithDefault(ApiKeyFilterSchema, DEFAULT_API_KEY_FILTER) });

export type ApiKeysUrlState = typeof API_KEYS_URL_STATE.defaults;

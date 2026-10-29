// ============================================
// lib/url-state/url-state.ts - typed, zod-parsed URL search-param state
// ============================================
// The codec lives in `@workspace/shared` (lib/url-state.ts) so the mobile app
// declares its URL state with the same code; this path stays the web's import.

export {
	defineUrlState,
	formatQueryString,
	InvalidUrlStateDefinitionError,
	isSameQuery,
	optionalBooleanUrlParam,
	optionalUrlParam,
	pageUrlParam,
	readSearchParam,
	toUrlSearchParams,
	urlParamWithDefault,
	type SearchParamsRecord,
	type UrlParamSchema,
	type UrlParamValue,
	type UrlSearchSource,
	type UrlState,
	type UrlStateCodec,
	type UrlStateOptions,
	type UrlStateShape,
} from "@workspace/shared";

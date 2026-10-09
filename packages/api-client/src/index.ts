// ============================================
// @workspace/api-client — core entry (".")
// ============================================
// The platform-neutral API client shared by the Next apps and the mobile app:
// the router built from the @workspace/shared contracts, fetch with zod
// validation of inputs and responses, the error envelope mapping, and the two
// session transports (cookie for browsers, body tokens for mobile, ADR 029).
// No next, react, react-dom, DOM-only or Node imports (lint-enforced); the
// React bindings live in the "./react" entry.

export { BodyTokenPairSchema, BodyTokenRefreshResponseSchema, type BodyTokenPair } from "./body-token-contract";
export {
	ApiClientConfigSchema,
	ApiClientHeadersSchema,
	ApiClientTransportSchema,
	CookieTransportSchema,
	createApiClientContext,
	InvalidApiClientConfigError,
	TokenTransportSchema,
	type ApiClientConfig,
	type ApiClientConfigIssue,
	type CookieTransport,
	type TokenTransport,
} from "./config";
export {
	ApiError,
	ApiErrorSchema,
	HTTP_UPGRADE_REQUIRED_STATUS,
	isDeadSessionError,
	readErrorPayload,
	SessionRefreshUnavailableError,
	UpgradeRequiredError,
	type ApiErrorBody,
	type ApiErrorExtras,
	type ApiErrorPayload,
} from "./errors";
export {
	AUTHORIZATION_HEADER,
	buildUrl,
	HttpMethodSchema,
	HTTP_FORBIDDEN_STATUS,
	HTTP_UNAUTHORIZED_STATUS,
	AbortErrorSchema,
	mergeProcedureHeaders,
	mutationIntentHeaders,
	NO_HTTP_RESPONSE_STATUS,
	REQUEST_ABORTED_ERROR,
	type HttpMethod,
} from "./http";
export { createRefreshCooldown, REFRESH_TRANSIENT_COOLDOWN_MS, RefreshResultSchema, type RefreshCall, type RefreshResult } from "./refresh";
export {
	createApiRequestContext,
	createCaller,
	createMutationCaller,
	createQueryCaller,
	createUncheckedApiRequestContext,
	fetchBodyTokenLifecycleMutation,
	fetchMutation,
	fetchMutationOrThrow,
	fetchMutationUnchecked,
	fetchQuery,
	fetchQueryOrThrow,
	TokenTransportRequiredError,
	withSessionRefresh,
	type ApiFailure,
	type ApiRequestContext,
	type ApiResponse,
	type ApiResponseKind,
	type ApiSuccess,
	type CallerTree,
	type CallerTreeBranch,
	type MutationCaller,
	type OnRefresh,
	type OnUnauthorized,
	type ProcedureCallOptions,
	type QueryCaller,
	type UncheckedApiRequestContext,
} from "./request";
export {
	ApiResponseContractError,
	MAX_RESPONSE_CONTRACT_ISSUES,
	parseResponseContract,
	parseResponseText,
	type ApiResponseContractIssue,
	type ResponseContractSource,
} from "./response-contract";
export {
	apiRouter,
	assertCompleteRouterTree,
	defineMutation,
	defineQuery,
	eachRouterEntry,
	isErasedProcedureDef,
	isRouterSubtree,
	mapRouterTree,
	resolveRequest,
	type AdminOrganizationScope,
	type ApiQueryKey,
	type ApiRouter,
	type ErasedMutationDef,
	type ErasedProcedureDef,
	type ErasedQueryDef,
	type MappedRouterTree,
	type MutationDef,
	type OrganizationScope,
	type ProcedureDef,
	type QueryDef,
	type ResolvedRequest,
	type ResolveRequestOptions,
	type RouterTree,
	type RouterTreeMapper,
	type RouterTreeValue,
	type ScopedQueryDef,
} from "./router";
export { TokenProviderSchema, type TokenProvider } from "./token-provider";
export { createTransientFailureBreaker, type TransientFailureBreaker, type TransientFailureBreakerOptions } from "./transient-failure-breaker";
export type { AnonymousTokenRequestTransport, CookieRequestTransport, OnSessionExpired, RequestTransport, TokenRequestTransport } from "./transport";

// ============================================
// lib/api/api-request.ts - the request core, re-exported from @workspace/api-client
// ============================================
// The platform-neutral request core (procedure callers, fetch + zod
// validation, the error envelope mapping, the 401 pipeline) lives in
// `@workspace/api-client`, shared with the mobile app. This module is the
// stable `@workspace/client/lib/api/api-request` entry the web apps already
// import; it adds nothing of its own.

export {
	ApiError,
	ApiErrorSchema,
	buildUrl,
	createApiRequestContext,
	createCaller,
	createMutationCaller,
	createQueryCaller,
	createRefreshCooldown,
	createUncheckedApiRequestContext,
	fetchMutation,
	fetchMutationOrThrow,
	fetchMutationUnchecked,
	fetchQuery,
	fetchQueryOrThrow,
	HttpMethodSchema,
	isDeadSessionError,
	mergeProcedureHeaders,
	mutationIntentHeaders,
	NO_HTTP_RESPONSE_STATUS,
	readErrorPayload,
	REFRESH_TRANSIENT_COOLDOWN_MS,
	RefreshResultSchema,
	REQUEST_ABORTED_ERROR,
	SessionRefreshUnavailableError,
	UpgradeRequiredError,
	withSessionRefresh,
	type ApiErrorBody,
	type ApiErrorExtras,
	type ApiErrorPayload,
	type ApiFailure,
	type ApiRequestContext,
	type ApiResponse,
	type ApiResponseKind,
	type ApiSuccess,
	type CallerTree,
	type CallerTreeBranch,
	type HttpMethod,
	type MutationCaller,
	type OnRefresh,
	type OnUnauthorized,
	type ProcedureCallOptions,
	type QueryCaller,
	type RefreshCall,
	type RefreshResult,
	type UncheckedApiRequestContext,
} from "@workspace/api-client";

// ============================================
// lib/api/endpoints.ts - the typed API router, re-exported from @workspace/api-client
// ============================================
// The router (procedure defs derived from the @workspace/shared contracts, the
// query-key model, the REST serializer and the router walker) lives in
// `@workspace/api-client`, shared with the mobile app. This module is the
// stable `@workspace/client/lib/api/endpoints` entry the web apps already
// import; it adds nothing of its own.

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
} from "@workspace/api-client";

// ============================================
// @workspace/api-client/react — React entry ("./react")
// ============================================
// TanStack Query bindings over the core router. Imports only `react` and
// `@tanstack/react-query` besides the core (lint-enforced), so the web apps and
// the mobile app bind the same procedures the same way. Cache keys come from
// the router defs (`def.queryKey(input)` / `def.scopeKey(scope)`).

export {
	buildClientRouter,
	createMutationProcedure,
	createProcedureForDef,
	createQueryProcedure,
	type ClientMutationProcedure,
	type ClientQueryProcedure,
	type ClientRouterTree,
} from "./hooks";

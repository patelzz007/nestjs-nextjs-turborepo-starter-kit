// API contract leaves of the `docs-publishing` context (ADR 084). Composed into `apiContract`
// (`src/contracts/index.ts`) as `apiContract.docsPublishing`.

import { defineContract, EmptyInputSchema } from "../../contracts/define-contract";
import { paginatedResponse, singleResponse } from "../../contracts/response";
import { docsPublishingRoutes } from "./docs-publishing.routes";
import {
	DocsSyncOverviewSchema,
	DocsSyncRunDetailSchema,
	DocsSyncRunIdParamSchema,
	DocsSyncRunListQuerySchema,
	DocsSyncRunSummarySchema,
	DocsSyncStartedSchema,
	DocsWebhookHandshakeSchema,
	StartDocsSyncSchema,
} from "./schemas/docs-sync";

/** Contract leaves composed into `apiContract.docsPublishing`. */
export const docsPublishingContract = {
	overview: defineContract({ method: "GET", path: docsPublishingRoutes.overview, input: EmptyInputSchema, response: singleResponse(DocsSyncOverviewSchema) }),
	runs: defineContract({ method: "GET", path: docsPublishingRoutes.runs, input: DocsSyncRunListQuerySchema, response: paginatedResponse(DocsSyncRunSummarySchema) }),
	run: defineContract({ method: "GET", path: docsPublishingRoutes.run, input: DocsSyncRunIdParamSchema, response: singleResponse(DocsSyncRunDetailSchema) }),
	startSync: defineContract({ method: "POST", path: docsPublishingRoutes.startSync, input: StartDocsSyncSchema, response: singleResponse(DocsSyncStartedSchema) }),
	revealHandshake: defineContract({
		method: "POST",
		path: docsPublishingRoutes.revealHandshake,
		input: EmptyInputSchema,
		response: singleResponse(DocsWebhookHandshakeSchema),
	}),
};

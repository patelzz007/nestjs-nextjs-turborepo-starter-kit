// API contract leaves owned by the `saved-views` context (enhancement 5.10). Composed into `apiContract`
// (`src/contracts/index.ts`) with identical keys.

import { defineContract } from "../../contracts/define-contract";
import { singleResponse } from "../../contracts/response";
import { DeleteSuccessDataSchema } from "../../schemas/api/api-response";
import { savedViewsRoutes } from "./routes";
import { CreateSavedListViewSchema, SavedListViewListSchema, SavedListViewPathSchema, SavedListViewSchema, SavedListViewsQuerySchema } from "./schemas/saved-views";

export const savedViewsContract = {
	list: defineContract({ method: "GET", path: savedViewsRoutes.list, input: SavedListViewsQuerySchema, response: singleResponse(SavedListViewListSchema) }),
	create: defineContract({ method: "POST", path: savedViewsRoutes.list, input: CreateSavedListViewSchema, response: singleResponse(SavedListViewSchema) }),
	remove: defineContract({ method: "DELETE", path: savedViewsRoutes.view, input: SavedListViewPathSchema, response: singleResponse(DeleteSuccessDataSchema) }),
};

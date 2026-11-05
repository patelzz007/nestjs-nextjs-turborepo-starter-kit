// ============================================
// presentation/http/saved-views.controller.ts — saved views on admin lists (enhancement 5.10)
// ============================================
// Admin staff only: a view is the person's own, and shared ones reach the other staff. Saving and removing
// are state-changing requests, so the audit trail records them.

import { Controller, Delete, Get, HttpStatus, Inject, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import {
	apiPath,
	CreateSavedListViewSchema,
	DeleteSuccessDataSchema,
	SavedListViewListSchema,
	SavedListViewPathSchema,
	SavedListViewSchema,
	SavedListViewsQuerySchema,
	type CreateSavedListViewInput,
	type DeleteSuccessData,
	type SavedListView,
	type SavedListViewList,
	type SavedListViewPath,
	type SavedListViewsQuery,
} from "@workspace/shared";

import type { ActorContext } from "../../../../platform/application/actor-context";
import { CurrentActor } from "../../../../platform/presentation/http/security/current-actor.decorator";
import { AdminAccessOnly } from "../../../../platform/presentation/http/security/decorators/admin-access.decorator";
import { RATE_LIMIT_POLICY, RateLimit } from "../../../../platform/presentation/http/security/throttling/rate-limit.decorator";
import { ZodBody, ZodParams, ZodQuery } from "../../../../platform/presentation/http/validation/decorators/zod-request.decorators";
import { ZodResponse } from "../../../../platform/presentation/http/validation/decorators/zod-response.decorators";
import { SAVED_VIEWS_SERVICE } from "../../application/ports/saved-list-view.store";
import type { SavedViewsService } from "../../application/services/saved-views.service";

@ApiTags("Saved views")
@ApiBearerAuth()
@AdminAccessOnly("Saved views are for the admin console's lists.")
@Controller(apiPath("/me"))
export class SavedViewsController {
	public constructor(@Inject(SAVED_VIEWS_SERVICE) private readonly views: SavedViewsService) {}

	@Get("saved-views")
	@ApiOperation({ summary: "A list's saved views: your own, then the ones other staff shared" })
	@ZodResponse(SavedListViewListSchema, { description: "The views" })
	public list(@CurrentActor() actor: ActorContext, @ZodQuery(SavedListViewsQuerySchema) query: SavedListViewsQuery): Promise<SavedListViewList> {
		return this.views.list(actor, query.listKey);
	}

	@RateLimit(RATE_LIMIT_POLICY.authenticatedMutation)
	@Post("saved-views")
	@ApiOperation({ summary: "Save the list's current filters under a name (optionally shared with the other staff); 409 for a name you already use" })
	@ZodResponse(SavedListViewSchema, { status: HttpStatus.CREATED, description: "The view" })
	public create(@CurrentActor() actor: ActorContext, @ZodBody(CreateSavedListViewSchema) input: CreateSavedListViewInput): Promise<SavedListView> {
		return this.views.save(actor, input);
	}

	@RateLimit(RATE_LIMIT_POLICY.authenticatedMutation)
	@Delete("saved-views/:viewId")
	@ApiOperation({ summary: "Remove one of your saved views; 404 for anyone else's" })
	@ZodResponse(DeleteSuccessDataSchema, { description: "Removed" })
	public remove(@CurrentActor() actor: ActorContext, @ZodParams(SavedListViewPathSchema) path: SavedListViewPath): Promise<DeleteSuccessData> {
		return this.views.remove(actor, path.viewId);
	}
}

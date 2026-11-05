// ============================================
// application/commands/status-page/status-page.commands.ts — the public status page's incidents (enhancement 4.5)
// ============================================

import { Command } from "@nestjs/cqrs";
import type { CreateStatusIncidentInput, PostStatusIncidentUpdateInput, StatusIncident } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

/** `POST /admin/operations/status/incidents`: open an incident with its first update. */
export class OpenStatusIncidentCommand extends Command<StatusIncident> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: CreateStatusIncidentInput,
	) {
		super();
	}
}

/** `POST /admin/operations/status/incidents/:incidentId/updates`: post an update (RESOLVED ends it). */
export class PostStatusIncidentUpdateCommand extends Command<StatusIncident> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly incidentId: string,
		public readonly input: PostStatusIncidentUpdateInput,
	) {
		super();
	}
}

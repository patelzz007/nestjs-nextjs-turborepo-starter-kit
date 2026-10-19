import { Query } from "@nestjs/cqrs";
import type { EmailLogEntry, EmailLogListQuery, PaginatedServiceResult } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

/** One page of the admin email log (newest first by default; shared list grammar). */
export class ListEmailLogQuery extends Query<PaginatedServiceResult<EmailLogEntry>> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: EmailLogListQuery,
	) {
		super();
	}
}

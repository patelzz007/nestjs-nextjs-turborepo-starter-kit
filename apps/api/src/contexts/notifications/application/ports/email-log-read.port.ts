import type { EmailLogEntry, EmailLogListQuery, PaginatedServiceResult } from "@workspace/shared";

import type { ActorContext } from "../../../../platform/application/actor-context";

/** The admin email log projection, read under the actor's RLS session. */
export interface EmailLogReadPort {
	list(actor: ActorContext, query: EmailLogListQuery): Promise<PaginatedServiceResult<EmailLogEntry>>;
}

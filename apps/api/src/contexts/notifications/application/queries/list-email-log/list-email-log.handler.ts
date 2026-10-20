import { Inject } from "@nestjs/common";
import { QueryHandler, type IQueryHandler } from "@nestjs/cqrs";
import type { EmailLogEntry, PaginatedServiceResult } from "@workspace/shared";

import type { EmailLogReadPort } from "../../ports/email-log-read.port";
import { EMAIL_LOG_READ } from "../../ports/notifications.tokens";
import { ListEmailLogQuery } from "./list-email-log.query";

/**
 * Reads through the projection port under the actor's RLS session.
 *
 * A row whose stored status is unknown (D32) fails the page with
 * `CORRUPT_AGGREGATE_STATE` rather than being hidden or shown with a guessed
 * status: the shared `EmailLogEntrySchema` has no "unknown" status, and adding
 * one is a contract change this migration does not authorise (§spec-7.3).
 */
@QueryHandler(ListEmailLogQuery)
export class ListEmailLogHandler implements IQueryHandler<ListEmailLogQuery, PaginatedServiceResult<EmailLogEntry>> {
	public constructor(@Inject(EMAIL_LOG_READ) private readonly emailLogs: EmailLogReadPort) {}

	public async execute(query: ListEmailLogQuery): Promise<PaginatedServiceResult<EmailLogEntry>> {
		return this.emailLogs.list(query.actor, query.input);
	}
}

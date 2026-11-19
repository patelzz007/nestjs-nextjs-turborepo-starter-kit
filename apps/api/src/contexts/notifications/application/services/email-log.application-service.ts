import { Inject, Injectable } from "@nestjs/common";
import type { EmailLogEntry, EmailLogListQuery, PaginatedServiceResult } from "@workspace/shared";

import type { ActorContext } from "../../../../platform/application/actor-context";
import type { EmailLogReadPort } from "../ports/email-log-read.port";
import { EMAIL_LOG_READ } from "../ports/notifications.tokens";

/** The admin email log (ADR 096): the outbound emails, newest first by default, read under the actor's RLS session. */
@Injectable()
export class EmailLogApplicationService {
	public constructor(@Inject(EMAIL_LOG_READ) private readonly emailLogs: EmailLogReadPort) {}

	/**
	 * One page of the log (shared list grammar). A row whose stored status is unknown (D32) fails the page with
	 * `CORRUPT_AGGREGATE_STATE` rather than being hidden or shown with a guessed status: the shared
	 * `EmailLogEntrySchema` has no "unknown" status, and adding one is a contract change (§spec-7.3).
	 */
	public list(actor: ActorContext, input: EmailLogListQuery): Promise<PaginatedServiceResult<EmailLogEntry>> {
		return this.emailLogs.list(actor, input);
	}
}

import { Inject } from "@nestjs/common";
import { QueryHandler, type IQueryHandler } from "@nestjs/cqrs";
import type { DataChangeLogSummary, PaginatedServiceResult } from "@workspace/shared";

import { DATA_CHANGE_READ_OPERATION } from "../../audit-read-operations";
import { AUDIT_READ_SESSION, type AuditReadScope, type AuditReadSession } from "../../ports/audit-read-session.port";
import { ListDataChangesQuery } from "./list-data-changes.query";

/**
 * `GET /admin/data-changes`. Reading the trail is itself a sensitive read (rules/10): the page and
 * its own audit row (who looked, with which filters, how much was released) commit together.
 */
@QueryHandler(ListDataChangesQuery)
export class ListDataChangesHandler implements IQueryHandler<ListDataChangesQuery, PaginatedServiceResult<DataChangeLogSummary>> {
	public constructor(@Inject(AUDIT_READ_SESSION) private readonly session: AuditReadSession) {}

	public async execute(query: ListDataChangesQuery): Promise<PaginatedServiceResult<DataChangeLogSummary>> {
		const { actor, input } = query;
		return this.session.read(
			{ operation: DATA_CHANGE_READ_OPERATION, reason: "Admin data-change viewer list", actor },
			async (scope: AuditReadScope): Promise<PaginatedServiceResult<DataChangeLogSummary>> => {
				const page = await scope.dataChangeLogs.list(input);
				await scope.sensitiveReads.record({ dataChangeView: { view: "list", returned: page.items.length, total: page.total, page: page.page } });
				return page;
			},
		);
	}
}

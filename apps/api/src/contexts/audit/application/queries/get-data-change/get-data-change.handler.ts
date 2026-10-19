import { Inject } from "@nestjs/common";
import { QueryHandler, type IQueryHandler } from "@nestjs/cqrs";
import type { DataChangeLogDetail } from "@workspace/shared";

import { DATA_CHANGE_READ_OPERATION, missingAuditRecord } from "../../audit-read-operations";
import { AUDIT_READ_SESSION, type AuditReadScope, type AuditReadSession } from "../../ports/audit-read-session.port";
import { GetDataChangeQuery } from "./get-data-change.query";

/** `GET /admin/data-changes/:id`. An unknown id is a 404 and writes no sensitive-read row; an opened record records which row it showed. */
@QueryHandler(GetDataChangeQuery)
export class GetDataChangeHandler implements IQueryHandler<GetDataChangeQuery, DataChangeLogDetail> {
	public constructor(@Inject(AUDIT_READ_SESSION) private readonly session: AuditReadSession) {}

	public async execute(query: GetDataChangeQuery): Promise<DataChangeLogDetail> {
		const { actor, input } = query;
		return this.session.read(
			{ operation: DATA_CHANGE_READ_OPERATION, reason: "Admin data-change viewer detail", actor },
			async (scope: AuditReadScope): Promise<DataChangeLogDetail> => {
				const detail = await scope.dataChangeLogs.findById(input.id);
				if (detail === null) {
					throw missingAuditRecord(input.id);
				}
				await scope.sensitiveReads.record({
					dataChangeView: { view: "detail", dataChangeId: detail.id, tableName: detail.tableName, rowId: detail.rowId, correlationId: detail.correlationId },
				});
				return detail;
			},
		);
	}
}

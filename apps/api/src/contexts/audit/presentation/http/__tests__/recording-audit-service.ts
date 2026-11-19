import type {
	AuditTrailEntry,
	AuditTrailListQuery,
	DataChangeLogDetail,
	DataChangeLogIdParam,
	DataChangeLogListQuery,
	DataChangeLogSummary,
	HttpAuditLogDetail,
	HttpAuditLogIdParam,
	HttpAuditLogListQuery,
	HttpAuditLogSummary,
	PaginatedServiceResult,
} from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";
import type { AuditApplicationService } from "../../../application/services/audit.application-service";
import { dataChangeLogDetail, httpAuditLogDetail } from "../../../application/__tests__/fakes/audit-records.fixtures";

/** One call the controller made: which read, for whom, with which validated input. */
export interface RecordedAuditCall {
	readonly method: keyof AuditApplicationService;
	readonly actor: ActorContext;
	readonly input: AuditTrailListQuery | DataChangeLogIdParam | DataChangeLogListQuery | HttpAuditLogIdParam | HttpAuditLogListQuery;
}

/** An empty page: the controllers only pass the service's answer on. */
function emptyPage<TItem>(): PaginatedServiceResult<TItem> {
	return { items: [], total: 0, page: 1, limit: 1, totalPages: 1, nextCursor: null, hasNext: false, hasPrevious: false };
}

/** The audit application service as the controllers see it, keeping every call — the controller's one call is what is checked. */
export class RecordingAuditService implements Pick<AuditApplicationService, keyof AuditApplicationService> {
	public readonly calls: RecordedAuditCall[] = [];

	public listHttpAuditLogs(actor: ActorContext, input: HttpAuditLogListQuery): Promise<PaginatedServiceResult<HttpAuditLogSummary>> {
		this.calls.push({ method: "listHttpAuditLogs", actor, input });
		return Promise.resolve(emptyPage());
	}

	public getHttpAuditLog(actor: ActorContext, input: HttpAuditLogIdParam): Promise<HttpAuditLogDetail> {
		this.calls.push({ method: "getHttpAuditLog", actor, input });
		return Promise.resolve(httpAuditLogDetail(1));
	}

	public listDataChanges(actor: ActorContext, input: DataChangeLogListQuery): Promise<PaginatedServiceResult<DataChangeLogSummary>> {
		this.calls.push({ method: "listDataChanges", actor, input });
		return Promise.resolve(emptyPage());
	}

	public getDataChange(actor: ActorContext, input: DataChangeLogIdParam): Promise<DataChangeLogDetail> {
		this.calls.push({ method: "getDataChange", actor, input });
		return Promise.resolve(dataChangeLogDetail(1));
	}

	public listAuditTrail(actor: ActorContext, input: AuditTrailListQuery): Promise<PaginatedServiceResult<AuditTrailEntry>> {
		this.calls.push({ method: "listAuditTrail", actor, input });
		return Promise.resolve(emptyPage());
	}
}

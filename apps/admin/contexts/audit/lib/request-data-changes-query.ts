import { eqFilter, listStateToListQuery, type TableListQueryInput } from "@workspace/client/lib/api/list-query";
import { dataChangeLogListQuery } from "@workspace/shared";

/** Oldest first: a request's (or job's) changes read in the order they were written. */
const WRITE_ORDER_SORT = "occurredAt";
/** Row changes one page of a request's / job's change list shows. */
export const REQUEST_DATA_CHANGES_LIMIT = 50;
/** The first page of a request's / job's changes. */
export const REQUEST_DATA_CHANGES_FIRST_PAGE = 1;

/** The filter of {@link requestDataChangesQuery}: one correlation id. */
export type RequestDataChangesFilter = Readonly<{ correlationId: { eq: string } | undefined }>;

/** `GET /admin/data-changes` for one page of the rows one request / job changed, in write order. */
export function requestDataChangesQuery(correlationId: string, page: number): TableListQueryInput<RequestDataChangesFilter> {
	return listStateToListQuery(dataChangeLogListQuery, {
		pagination: { page, limit: REQUEST_DATA_CHANGES_LIMIT },
		sort: WRITE_ORDER_SORT,
		filter: { correlationId: eqFilter(correlationId) },
	});
}

import { ApiPaginatedMetaSchema, ApiResponseMetaSchema, type ApiResponseMeta } from "@workspace/shared";

import { INBOX_MAX_LIMIT, INBOX_PAGE_SIZE } from "../inbox-query";
import { feedStateOf, type InboxPage } from "../inbox-state";

const GENERATED_AT_MS = 1_793_000_000_000;
const BASE_META = { requestId: "request-1", correlationId: "correlation-1", timestamp: GENERATED_AT_MS };
const MAX_PAGES = INBOX_MAX_LIMIT / INBOX_PAGE_SIZE;

function pageOf(hasNext: boolean): InboxPage {
	const meta: ApiResponseMeta = ApiPaginatedMetaSchema.parse({
		...BASE_META,
		limit: INBOX_PAGE_SIZE,
		total: INBOX_MAX_LIMIT,
		page: 1,
		totalPages: MAX_PAGES,
		nextCursor: hasNext ? "next" : null,
		hasNext,
		hasPrevious: false,
	});
	return { data: [], meta };
}

describe("feedStateOf (enhancement 6.4)", () => {
	it("loads, then shows the list, with more pages while the API has them", () => {
		expect(feedStateOf({ page: undefined, failed: false, offline: false, pages: 1 })).toEqual({ kind: "loading" });
		expect(feedStateOf({ page: pageOf(true), failed: false, offline: false, pages: 1 })).toEqual({ kind: "ready", notifications: [], hasMore: true, outOfDate: null });
		expect(feedStateOf({ page: pageOf(false), failed: false, offline: false, pages: 1 })).toEqual(expect.objectContaining({ hasMore: false }));
		expect(feedStateOf({ page: pageOf(true), failed: false, offline: false, pages: MAX_PAGES })).toEqual(expect.objectContaining({ hasMore: false }));
	});

	it("keeps the list in memory readable offline, marked as possibly out of date, with no more pages to wait on", () => {
		expect(feedStateOf({ page: pageOf(true), failed: true, offline: true, pages: 1 })).toEqual({ kind: "ready", notifications: [], hasMore: false, outOfDate: "offline" });
	});

	it("keeps the list after a failed refresh online, marked as possibly out of date", () => {
		expect(feedStateOf({ page: pageOf(true), failed: true, offline: false, pages: 1 })).toEqual({
			kind: "ready",
			notifications: [],
			hasMore: true,
			outOfDate: "refreshFailed",
		});
	});

	it("says why an inbox never loaded can't show: offline, or failed", () => {
		expect(feedStateOf({ page: undefined, failed: false, offline: true, pages: 1 })).toEqual({ kind: "error", reason: "offline" });
		expect(feedStateOf({ page: undefined, failed: true, offline: false, pages: 1 })).toEqual({ kind: "error", reason: "failed" });
	});

	it("reads no more pages from a meta that isn't paginated", () => {
		const page: InboxPage = { data: [], meta: ApiResponseMetaSchema.parse(BASE_META) };
		expect(feedStateOf({ page, failed: false, offline: false, pages: 1 })).toEqual(expect.objectContaining({ hasMore: false }));
	});
});

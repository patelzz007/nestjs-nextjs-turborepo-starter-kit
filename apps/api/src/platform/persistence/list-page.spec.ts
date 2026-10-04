import type { Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import { fetchListPage, keysetPagePosition, mapListResult, toPaginatedServiceResult, type ListPageSpec } from "./list-page";
import { timestampIdKeyset } from "./list-query/keyset-cursor";
import { CursorPaginationUnsupportedError, InvalidListCursorError } from "./persistence.errors";

interface Row {
	readonly id: string;
	readonly createdAt: number;
}

/** A real Prisma `where` type, so the spec exercises the shapes repositories actually pass. */
type Where = Prisma.ProductWhereInput;
type OrderBy = Prisma.ProductOrderByWithRelationInput;

const EPOCH = 1_790_812_800_000;
const PAGE_SIZE = 2;
const TOTAL_ROWS = 5;

const ROWS: readonly Row[] = [
	{ id: "row-3", createdAt: EPOCH },
	{ id: "row-2", createdAt: EPOCH },
	{ id: "row-1", createdAt: EPOCH - 1 },
];

const KEYSET = timestampIdKeyset<Row, Where>(
	(row: Row) => ({ at: row.createdAt, id: row.id }),
	({ at, id }): Where => ({ OR: [{ createdAt: { lt: at } }, { createdAt: at, id: { lt: id } }] }),
);

function buildSpec(overrides: Partial<ListPageSpec<Where, OrderBy, Row>> = {}): ListPageSpec<Where, OrderBy, Row> & {
	readonly findMany: ReturnType<typeof vi.fn<ListPageSpec<Where, OrderBy, Row>["findMany"]>>;
} {
	const findMany = vi.fn<ListPageSpec<Where, OrderBy, Row>["findMany"]>((args) => Promise.resolve(ROWS.slice(0, args.take)));
	return {
		where: { sku: "t-1" },
		order: { orderBy: [{ createdAt: "desc" }, { id: "desc" }], isDefault: true },
		keyset: KEYSET,
		and: (left: Where, right: Where): Where => ({ AND: [left, right] }),
		count: () => Promise.resolve(TOTAL_ROWS),
		...overrides,
		findMany,
	};
}

describe("fetchListPage", () => {
	it("offset mode: skips (page - 1) * limit rows in the requested order and hands out a continuation cursor", async () => {
		const spec = buildSpec();
		const result = await fetchListPage({ page: 2, limit: PAGE_SIZE }, spec);
		expect(spec.findMany).toHaveBeenCalledWith({ where: { sku: "t-1" }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: PAGE_SIZE, take: PAGE_SIZE });
		expect(result).toEqual(expect.objectContaining({ total: TOTAL_ROWS, page: 2, totalPages: 3, hasNext: true, hasPrevious: true }));
		expect(result.nextCursor).toBe(KEYSET.encode({ id: "row-2", createdAt: EPOCH }));
	});

	it("offset mode with a custom sort never hands out a cursor", async () => {
		const spec = buildSpec({ order: { orderBy: [{ id: "asc" }], isDefault: false } });
		const result = await fetchListPage({ page: 1, limit: PAGE_SIZE }, spec);
		expect(result.nextCursor).toBeNull();
		expect(result.hasNext).toBe(true);
	});

	it("keyset mode: reads limit + 1 rows strictly after the cursor position", async () => {
		const spec = buildSpec();
		const cursor = KEYSET.encode({ id: "row-4", createdAt: EPOCH });
		const result = await fetchListPage({ page: 1, limit: PAGE_SIZE, cursor }, spec);
		expect(spec.findMany).toHaveBeenCalledWith({
			where: { AND: [{ sku: "t-1" }, { OR: [{ createdAt: { lt: EPOCH } }, { createdAt: EPOCH, id: { lt: "row-4" } }] }] },
			orderBy: [{ createdAt: "desc" }, { id: "desc" }],
			take: PAGE_SIZE + 1,
		});
		expect(result.items).toEqual(ROWS.slice(0, PAGE_SIZE));
		expect(result.hasNext).toBe(true);
		expect(result.nextCursor).toBe(KEYSET.encode({ id: "row-2", createdAt: EPOCH }));
	});

	it("keyset mode derives page and hasPrevious from the rows before the cursor instead of faking them", async () => {
		// 5 rows match; 3 lie after the cursor → 2 precede it → this slice starts on page 2.
		const rowsAfterCursor = 3;
		const count = vi.fn<ListPageSpec<Where, OrderBy, Row>["count"]>((where: Where) => Promise.resolve(where.AND === undefined ? TOTAL_ROWS : rowsAfterCursor));
		const spec = buildSpec({ count });
		const result = await fetchListPage({ page: 1, limit: PAGE_SIZE, cursor: KEYSET.encode({ id: "row-4", createdAt: EPOCH }) }, spec);
		expect(result).toEqual(expect.objectContaining({ total: TOTAL_ROWS, page: 2, totalPages: 3, hasPrevious: true }));
		expect(count).toHaveBeenCalledTimes(2);
	});

	it("keyset mode reports no previous page when nothing precedes the cursor", async () => {
		const spec = buildSpec({ count: () => Promise.resolve(TOTAL_ROWS) });
		const result = await fetchListPage({ page: 1, limit: PAGE_SIZE, cursor: KEYSET.encode({ id: "row-9", createdAt: EPOCH + 1 }) }, spec);
		expect(result).toEqual(expect.objectContaining({ page: 1, hasPrevious: false }));
	});

	it("keyset mode reports the last page without a cursor", async () => {
		const spec = buildSpec();
		const result = await fetchListPage({ page: 1, limit: ROWS.length, cursor: KEYSET.encode({ id: "row-9", createdAt: EPOCH }) }, spec);
		expect(result.hasNext).toBe(false);
		expect(result.nextCursor).toBeNull();
	});

	it("rejects a malformed cursor, a cursor with a custom sort, and a cursor on an offset-only resource", async () => {
		await expect(fetchListPage({ page: 1, limit: PAGE_SIZE, cursor: "garbage" }, buildSpec())).rejects.toBeInstanceOf(InvalidListCursorError);
		await expect(fetchListPage({ page: 1, limit: PAGE_SIZE, cursor: Buffer.from("{not json", "utf-8").toString("base64url") }, buildSpec())).rejects.toBeInstanceOf(
			InvalidListCursorError,
		);
		await expect(
			fetchListPage({ page: 1, limit: PAGE_SIZE, cursor: KEYSET.encode(ROWS[0] ?? { id: "x", createdAt: EPOCH }) }, buildSpec({ order: { orderBy: [], isDefault: false } })),
		).rejects.toBeInstanceOf(InvalidListCursorError);
		await expect(fetchListPage({ page: 1, limit: PAGE_SIZE, cursor: "abc" }, buildSpec({ keyset: undefined }))).rejects.toBeInstanceOf(CursorPaginationUnsupportedError);
	});
});

describe("keysetPagePosition", () => {
	it("places the slice on the offset page holding its first row", () => {
		expect(keysetPagePosition(10, 10, 3)).toEqual({ page: 1, totalPages: 4, hasPrevious: false });
		expect(keysetPagePosition(10, 7, 3)).toEqual({ page: 2, totalPages: 4, hasPrevious: true });
		expect(keysetPagePosition(10, 1, 3)).toEqual({ page: 4, totalPages: 4, hasPrevious: true });
	});

	it("stays inside the contract's bounds when the two counts race with a write", () => {
		expect(keysetPagePosition(4, 0, 2)).toEqual({ page: 2, totalPages: 2, hasPrevious: true });
		expect(keysetPagePosition(4, 6, 2)).toEqual({ page: 1, totalPages: 2, hasPrevious: false });
		expect(keysetPagePosition(0, 0, 2)).toEqual({ page: 1, totalPages: 1, hasPrevious: false });
	});
});

describe("list result helpers", () => {
	it("maps items and adds the page size for the response interceptor", () => {
		const mapped = mapListResult({ items: ROWS, total: 3, page: 1, totalPages: 1, nextCursor: null, hasNext: false, hasPrevious: false }, (row: Row): string => row.id);
		expect(toPaginatedServiceResult(mapped, { limit: PAGE_SIZE })).toEqual({
			items: ["row-3", "row-2", "row-1"],
			limit: PAGE_SIZE,
			total: 3,
			page: 1,
			totalPages: 1,
			nextCursor: null,
			hasNext: false,
			hasPrevious: false,
		});
	});
});

import type { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { z } from "zod";

import { defineKeyset, timestampIdKeyset } from "./keyset-cursor";
import { buildListOrder, type SortColumns } from "./list-order";
import {
	fieldWhere,
	toPrismaBooleanFilter,
	toPrismaComparableFilter,
	toPrismaEqualityFilter,
	toPrismaNullableBooleanFilter,
	toPrismaNullableComparableFilter,
	toPrismaNullableEqualityFilter,
	toPrismaNullableStringFilter,
	toPrismaStringFilter,
} from "./prisma-filter";

type TestSortField = "name" | "createdAt" | "id";

interface TestOrderBy {
	readonly name?: "asc" | "desc";
	readonly createdAt?: "asc" | "desc";
	readonly id?: "asc" | "desc";
}

const TEST_SORT_COLUMNS: SortColumns<TestSortField, TestOrderBy> = {
	name: (direction) => ({ name: direction }),
	createdAt: (direction) => ({ createdAt: direction }),
	id: (direction) => ({ id: direction }),
};

const TIE_BREAKER = (direction: "asc" | "desc"): TestOrderBy => ({ id: direction });
const EPOCH = 1_790_812_800_000;

describe("buildListOrder", () => {
	it("maps every sort term to its column and appends the id tie-breaker in the last term's direction", () => {
		const order = buildListOrder(
			{
				terms: [
					{ field: "name", direction: "asc" },
					{ field: "createdAt", direction: "desc" },
				],
				isDefault: false,
			},
			{ columns: TEST_SORT_COLUMNS, tieBreaker: TIE_BREAKER },
		);
		expect(order).toEqual({ orderBy: [{ name: "asc" }, { createdAt: "desc" }, { id: "desc" }], isDefault: false });
	});

	it("does not append a tie-breaker after a field that is already unique", () => {
		const order = buildListOrder({ terms: [{ field: "id", direction: "asc" }], isDefault: true }, { columns: TEST_SORT_COLUMNS, tieBreaker: TIE_BREAKER, uniqueField: "id" });
		expect(order.orderBy).toEqual([{ id: "asc" }]);
	});

	it("carries the default-order flag through for keyset pagination", () => {
		expect(buildListOrder({ terms: [{ field: "createdAt", direction: "desc" }], isDefault: true }, { columns: TEST_SORT_COLUMNS, tieBreaker: TIE_BREAKER }).isDefault).toBe(
			true,
		);
	});
});

describe("prisma filter translators", () => {
	it("returns undefined when the field was not filtered or had no operators", () => {
		expect(toPrismaComparableFilter(undefined)).toBeUndefined();
		expect(toPrismaComparableFilter({})).toBeUndefined();
		expect(toPrismaStringFilter({})).toBeUndefined();
		expect(toPrismaBooleanFilter({})).toBeUndefined();
		expect(toPrismaNullableBooleanFilter({})).toBeUndefined();
	});

	it("maps comparison and set operators to Prisma names", () => {
		expect(toPrismaComparableFilter({ eq: 1, ne: 2, gt: 3, gte: 4, lt: 5, lte: 6, in: [7, 8], nin: [9] })).toEqual({
			equals: 1,
			not: 2,
			gt: 3,
			gte: 4,
			lt: 5,
			lte: 6,
			in: [7, 8],
			notIn: [9],
		});
		expect(toPrismaEqualityFilter({ eq: "A", in: ["A", "B"] })).toEqual({ equals: "A", in: ["A", "B"] });
	});

	it("maps isNull on nullable columns and lets it win over eq / ne", () => {
		expect(toPrismaNullableComparableFilter({ isNull: true })).toEqual({ equals: null });
		expect(toPrismaNullableComparableFilter({ isNull: false, gte: EPOCH })).toEqual({ not: null, gte: EPOCH });
		expect(toPrismaNullableEqualityFilter({ eq: "x", isNull: true })).toEqual({ equals: null });
		expect(toPrismaNullableBooleanFilter({ isNull: false })).toEqual({ not: null });
	});

	it("makes every string operator case-insensitive", () => {
		expect(toPrismaStringFilter({ eq: "Shoe", contains: "sh", startsWith: "S" })).toEqual({ equals: "Shoe", contains: "sh", startsWith: "S", mode: "insensitive" });
		expect(toPrismaNullableStringFilter({ isNull: true })).toEqual({ equals: null, mode: "insensitive" });
		expect(toPrismaNullableStringFilter({})).toBeUndefined();
	});

	it("translates booleans", () => {
		expect(toPrismaBooleanFilter({ eq: false })).toEqual({ equals: false });
		expect(toPrismaNullableBooleanFilter({ eq: true })).toEqual({ equals: true });
	});

	it("fieldWhere maps a translated filter onto its column, or contributes nothing", () => {
		expect(fieldWhere(toPrismaEqualityFilter({ eq: "A" }), (status) => ({ status }))).toEqual([{ status: { equals: "A" } }]);
		expect(fieldWhere(toPrismaEqualityFilter(undefined), (status) => ({ status }))).toEqual([]);
	});
});

describe("keysets", () => {
	interface Row {
		readonly id: string;
		readonly createdAt: number;
	}
	type Where = Prisma.ProductWhereInput;
	const keyset = timestampIdKeyset<Row, Where>(
		(row: Row) => ({ at: row.createdAt, id: row.id }),
		({ at, id }): Where => ({ OR: [{ createdAt: { lt: at } }, { createdAt: at, id: { lt: id } }] }),
	);

	it("round-trips a row position through an opaque base64url cursor", () => {
		const cursor = keyset.encode({ id: "row-1", createdAt: EPOCH });
		expect(cursor).toMatch(/^[A-Za-z0-9_-]+$/);
		expect(keyset.decode(cursor)).toEqual({ OR: [{ createdAt: { lt: EPOCH } }, { createdAt: EPOCH, id: { lt: "row-1" } }] });
	});

	it("rejects malformed, non-JSON and tampered cursors", () => {
		expect(keyset.decode("%%%")).toBeNull();
		expect(keyset.decode(Buffer.from("not json", "utf-8").toString("base64url"))).toBeNull();
		expect(keyset.decode(Buffer.from(JSON.stringify({ at: -1, id: "x" }), "utf-8").toString("base64url"))).toBeNull();
		expect(keyset.decode(Buffer.from(JSON.stringify({ at: EPOCH, id: "x", extra: true }), "utf-8").toString("base64url"))).toBeNull();
	});

	it("defineKeyset validates the decoded position with the resource's own schema", () => {
		const numericKeyset = defineKeyset({
			position: z.object({ id: z.number().int().nonnegative() }).strict(),
			read: (row: { readonly id: number }) => ({ id: row.id }),
			after: (position) => ({ id: { gt: position.id } }),
		});
		expect(numericKeyset.decode(numericKeyset.encode({ id: 41 }))).toEqual({ id: { gt: 41 } });
		expect(numericKeyset.decode(Buffer.from(JSON.stringify({ id: "41" }), "utf-8").toString("base64url"))).toBeNull();
	});
});

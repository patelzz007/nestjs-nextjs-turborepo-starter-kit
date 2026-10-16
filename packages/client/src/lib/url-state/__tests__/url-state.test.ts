import { describe, expect, it } from "vitest";
import { z } from "zod";

import {
	defineUrlState,
	formatQueryString,
	InvalidUrlStateDefinitionError,
	isSameQuery,
	optionalBooleanUrlParam,
	optionalUrlParam,
	readSearchParam,
	toUrlSearchParams,
	urlParamWithDefault,
} from "./url-state";

const StatusSchema = z.enum(["active", "locked"]);
const DEFAULT_WEEKS = 8;
const WeeksSchema = z.coerce.number().int().min(1).max(52);

const DEMO_URL_STATE = defineUrlState(
	{
		weeks: urlParamWithDefault(WeeksSchema, DEFAULT_WEEKS),
		status: optionalUrlParam(StatusSchema),
		archived: optionalBooleanUrlParam(),
		key: optionalUrlParam(z.string().min(1)),
	},
	{ urlKeys: { status: "filter[status]" } },
);

describe("readSearchParam", () => {
	it("reads URLSearchParams (first value of a repeated key)", () => {
		expect(readSearchParam(new URLSearchParams("a=1&a=2"), "a")).toBe("1");
		expect(readSearchParam(new URLSearchParams("a=1"), "b")).toBeUndefined();
	});

	it("reads a Next.js searchParams record (string, array or absent)", () => {
		expect(readSearchParam({ a: "1" }, "a")).toBe("1");
		expect(readSearchParam({ a: ["2", "3"] }, "a")).toBe("2");
		expect(readSearchParam({ a: [] }, "a")).toBeUndefined();
		expect(readSearchParam({ a: undefined }, "a")).toBeUndefined();
	});
});

describe("toUrlSearchParams", () => {
	it("copies URLSearchParams without aliasing the source", () => {
		const source = new URLSearchParams("a=1");
		const copy = toUrlSearchParams(source);
		copy.set("a", "2");
		expect(source.get("a")).toBe("1");
	});

	it("expands a record, keeping repeated values and skipping absent ones", () => {
		expect(toUrlSearchParams({ a: ["1", "2"], b: "3", c: undefined }).toString()).toBe("a=1&a=2&b=3");
		expect(toUrlSearchParams(undefined).toString()).toBe("");
	});
});

describe("formatQueryString / isSameQuery", () => {
	it("keeps the list grammar's brackets readable", () => {
		expect(formatQueryString(new URLSearchParams([["filter[status]", "a b"]]))).toBe("filter[status]=a+b");
	});

	it("compares queries regardless of bracket encoding", () => {
		expect(isSameQuery("filter[status]=locked", "filter%5Bstatus%5D=locked")).toBe(true);
		expect(isSameQuery("a=1", "a=2")).toBe(false);
	});
});

describe("defineUrlState", () => {
	it("exposes the defaults and the URL keys it owns", () => {
		expect(DEMO_URL_STATE.defaults).toEqual({ weeks: DEFAULT_WEEKS, status: undefined, archived: undefined, key: undefined });
		expect(DEMO_URL_STATE.urlKeys).toEqual(["weeks", "filter[status]", "archived", "key"]);
	});

	it("always carries every field, even absent optional ones (so a spread patch can clear them)", () => {
		expect(Object.keys(DEMO_URL_STATE.defaults)).toEqual(["weeks", "status", "archived", "key"]);
		expect(Object.keys(DEMO_URL_STATE.parse(new URLSearchParams("weeks=4")))).toEqual(["weeks", "status", "archived", "key"]);
		const patched = { ...DEMO_URL_STATE.parse(new URLSearchParams("key=a&archived=true")), ...DEMO_URL_STATE.defaults };
		expect(DEMO_URL_STATE.serialize(patched)).toBe("");
	});

	it("parses typed values from URLSearchParams and from a page searchParams record", () => {
		const expected = { weeks: 4, status: "locked", archived: true, key: "invite" };
		expect(DEMO_URL_STATE.parse(new URLSearchParams("weeks=4&filter[status]=locked&archived=true&key=invite"))).toEqual(expected);
		expect(DEMO_URL_STATE.parse({ weeks: "4", "filter[status]": "locked", archived: "true", key: ["invite", "ignored"] })).toEqual(expected);
	});

	it("falls back to the default of each invalid param independently, never throwing", () => {
		expect(DEMO_URL_STATE.parse(new URLSearchParams("weeks=999&filter[status]=locked&archived=yes&key="))).toEqual({
			weeks: DEFAULT_WEEKS,
			status: "locked",
			archived: undefined,
			key: undefined,
		});
		expect(DEMO_URL_STATE.parse({ weeks: "abc", "filter[status]": "<script>" })).toEqual(DEMO_URL_STATE.defaults);
	});

	it("reads a mapped field only under its URL key", () => {
		expect(DEMO_URL_STATE.parse(new URLSearchParams("status=locked")).status).toBeUndefined();
	});

	it("serializes the default state to an empty query (clean URL)", () => {
		expect(DEMO_URL_STATE.serialize(DEMO_URL_STATE.defaults)).toBe("");
		expect(DEMO_URL_STATE.href("/users", DEMO_URL_STATE.defaults)).toBe("/users");
	});

	it("serializes only non-default params, under their URL keys", () => {
		const state: typeof DEMO_URL_STATE.defaults = { weeks: 12, status: "active", archived: false, key: undefined };
		expect(DEMO_URL_STATE.serialize(state)).toBe("weeks=12&filter[status]=active&archived=false");
		expect(DEMO_URL_STATE.href("/x", state)).toBe("/x?weeks=12&filter[status]=active&archived=false");
	});

	it("keeps params it does not own and replaces the ones it does", () => {
		const current = new URLSearchParams("tab=states&weeks=4&filter[status]=locked");
		expect(DEMO_URL_STATE.serialize({ ...DEMO_URL_STATE.defaults, weeks: 12 }, current)).toBe("tab=states&weeks=12");
		expect(DEMO_URL_STATE.serialize(DEMO_URL_STATE.defaults, { tab: "states", key: "old" })).toBe("tab=states");
	});

	it("round-trips: parse(serialize(state)) === state", () => {
		const state = DEMO_URL_STATE.parse(new URLSearchParams("weeks=20&filter[status]=active&archived=true&key=k"));
		expect(DEMO_URL_STATE.parse(new URLSearchParams(DEMO_URL_STATE.serialize(state)))).toEqual(state);
	});

	it("rejects a field without a default for an absent param", () => {
		expect(() => defineUrlState({ id: z.uuid() })).toThrow(InvalidUrlStateDefinitionError);
		expect(() => defineUrlState({ id: z.uuid() })).toThrow(/field\(s\) id need a default/);
	});

	it("rejects two fields mapped to the same URL key", () => {
		expect(() => defineUrlState({ a: optionalUrlParam(z.string()), b: optionalUrlParam(z.string()) }, { urlKeys: { b: "a" } })).toThrow(/same URL key: a/);
	});
});

describe("param builders", () => {
	it("optionalUrlParam: the value when valid, otherwise undefined", () => {
		const schema = optionalUrlParam(StatusSchema);
		expect(schema.parse("active")).toBe("active");
		expect(schema.parse("nope")).toBeUndefined();
		expect(schema.parse(undefined)).toBeUndefined();
	});

	it("urlParamWithDefault: the value when valid, otherwise the fallback", () => {
		const schema = urlParamWithDefault(WeeksSchema, DEFAULT_WEEKS);
		expect(schema.parse("4")).toBe(4);
		expect(schema.parse("-1")).toBe(DEFAULT_WEEKS);
		expect(schema.parse(undefined)).toBe(DEFAULT_WEEKS);
	});

	it("optionalBooleanUrlParam: only the literals true/false", () => {
		const schema = optionalBooleanUrlParam();
		expect(schema.parse("true")).toBe(true);
		expect(schema.parse("false")).toBe(false);
		expect(schema.parse("1")).toBeUndefined();
		expect(schema.parse(undefined)).toBeUndefined();
	});
});

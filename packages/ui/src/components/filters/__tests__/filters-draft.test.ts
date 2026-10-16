// @vitest-environment node
import { describe, expect, it } from "vitest";

import { createFilterDraft, filterDraftReducer, isFilterDraftCommittable } from "../filters-draft";
import type { FilterDraft } from "../filters-types";

function open(): FilterDraft {
	const draft = filterDraftReducer(null, { type: "openCreate" });
	if (draft === null) {
		throw new Error("expected an open draft");
	}
	return draft;
}

describe("filterDraftReducer", () => {
	it("opens a create draft at the field step", (): void => {
		expect(open()).toEqual(createFilterDraft());
		expect(filterDraftReducer(null, { type: "openCreate", cascaderPath: ["name"] })?.cascaderPath).toEqual(["name"]);
	});

	it("opens an amend draft beside the field's siblings", (): void => {
		const draft = filterDraftReducer(null, { type: "openAmend", ruleId: "r1", step: "value", path: ["name", "first"], operator: "is", value: "a" });
		expect(draft).toMatchObject({ ruleId: "r1", step: "value", cascaderPath: ["name"], operator: "is", value: "a" });
	});

	it("browses and searches without committing", (): void => {
		const browsed = filterDraftReducer(open(), { type: "setCascaderPath", path: ["name"] });
		expect(browsed?.cascaderPath).toEqual(["name"]);
		expect(filterDraftReducer(browsed, { type: "setQuery", query: "fi" })?.query).toBe("fi");
		const same = open();
		expect(filterDraftReducer(same, { type: "setQuery", query: "" })).toBe(same);
	});

	it("commits as soon as a field is chosen", (): void => {
		const ready = filterDraftReducer(open(), { type: "selectField", path: ["status"], defaultOperator: "is" });
		expect(ready).toMatchObject({ status: "ready", path: ["status"], operator: "is", value: undefined, step: "operator" });
		expect(isFilterDraftCommittable(ready)).toBe(true);
		expect(isFilterDraftCommittable(open())).toBe(false);
		expect(isFilterDraftCommittable(null)).toBe(false);
	});

	it("skips the value step for an operator that takes none", (): void => {
		expect(filterDraftReducer(open(), { type: "selectOperator", operator: "empty", arity: "none", value: "x" })).toMatchObject({ status: "ready", value: undefined });
		expect(filterDraftReducer(open(), { type: "selectOperator", operator: "is", arity: "one", value: "x" })).toMatchObject({ status: "editing", step: "value", value: "x" });
	});

	it("sets, commits, steps back and jumps", (): void => {
		const atValue = filterDraftReducer(open(), { type: "goto", step: "value" });
		expect(filterDraftReducer(atValue, { type: "setValue", value: 4 })?.value).toBe(4);
		expect(filterDraftReducer(atValue, { type: "commit", value: 5 })).toMatchObject({ status: "ready", value: 5 });
		expect(filterDraftReducer(atValue, { type: "back" })?.step).toBe("operator");
		expect(filterDraftReducer(open(), { type: "back" })).toBeNull();
		expect(filterDraftReducer(open(), { type: "close" })).toBeNull();
		expect(filterDraftReducer(null, { type: "setValue", value: 1 })).toBeNull();
	});
});

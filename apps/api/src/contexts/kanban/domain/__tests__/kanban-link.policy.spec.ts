import { describe, expect, it } from "vitest";

import { KanbanLinkInvalidError } from "../errors/kanban.errors";
import { linkAsSeenBy, toStoredLink, type KanbanStoredLink } from "../policies/kanban-link.policy";

describe("toStoredLink", () => {
	it("stores a link one way round: 'blocked by X' is 'X blocks this'", () => {
		expect(toStoredLink("a", "b", "BLOCKS")).toEqual({ sourceTaskId: "a", targetTaskId: "b", kind: "BLOCKS" });
		expect(toStoredLink("a", "b", "BLOCKED_BY")).toEqual({ sourceTaskId: "b", targetTaskId: "a", kind: "BLOCKS" });
		expect(toStoredLink("a", "b", "RELATES_TO")).toEqual({ sourceTaskId: "a", targetTaskId: "b", kind: "RELATES_TO" });
	});

	it("refuses a link from an item to itself", () => {
		expect(() => toStoredLink("a", "a", "RELATES_TO")).toThrow(KanbanLinkInvalidError);
	});
});

describe("linkAsSeenBy", () => {
	it("reads a blocking link from either end, and a relation the same from both", () => {
		const blocks: KanbanStoredLink = { sourceTaskId: "a", targetTaskId: "b", kind: "BLOCKS" };
		expect(linkAsSeenBy("a", blocks)).toEqual({ kind: "BLOCKS", otherTaskId: "b" });
		expect(linkAsSeenBy("b", blocks)).toEqual({ kind: "BLOCKED_BY", otherTaskId: "a" });
		expect(linkAsSeenBy("b", { ...blocks, kind: "RELATES_TO" })).toEqual({ kind: "RELATES_TO", otherTaskId: "a" });
	});
});

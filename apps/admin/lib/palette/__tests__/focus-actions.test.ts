import { Pencil } from "lucide-react";
import { describe, expect, it, vi } from "vitest";

import { matchingFocusActions, type FocusActions } from "../focus-actions";

const FOCUS: FocusActions = {
	heading: "STORY-142",
	actions: [
		{ id: "move-to", label: "Move to…", icon: Pencil, keywords: ["parent"], run: vi.fn() },
		{ id: "status", label: "Change status to Review", icon: Pencil, keywords: ["column"], run: vi.fn() },
	],
};

describe("matchingFocusActions", () => {
	it("lists every action for an empty search, and matches labels and keywords ignoring case", () => {
		expect(matchingFocusActions(FOCUS, "  ")).toHaveLength(2);
		expect(matchingFocusActions(FOCUS, "PARENT").map((action) => action.id)).toEqual(["move-to"]);
		expect(matchingFocusActions(FOCUS, "review").map((action) => action.id)).toEqual(["status"]);
		expect(matchingFocusActions(FOCUS, "delete")).toEqual([]);
	});
});

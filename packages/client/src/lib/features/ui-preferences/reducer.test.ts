import { describe, expect, it } from "vitest";

import { uiPreferencesActions } from "./actions";
import { uiPreferencesReducer } from "./reducer";
import { selectPreferences, selectRewardsViewMode } from "./selectors";
import { INITIAL_UI_PREFERENCES_STATE, UiPreferencesSchema } from "./state";

describe("uiPreferencesReducer", () => {
	it("starts with the grid layout", () => {
		expect(selectRewardsViewMode(INITIAL_UI_PREFERENCES_STATE)).toBe("grid");
	});

	it("changes the rewards view mode", () => {
		const list = uiPreferencesReducer(INITIAL_UI_PREFERENCES_STATE, uiPreferencesActions.rewardsViewModeChanged("list"));

		expect(list.rewardsViewMode).toBe("list");
		expect(uiPreferencesReducer(list, uiPreferencesActions.rewardsViewModeChanged("grid")).rewardsViewMode).toBe("grid");
	});

	it("restores persisted preferences", () => {
		const restored = uiPreferencesReducer(INITIAL_UI_PREFERENCES_STATE, uiPreferencesActions.preferencesRestored({ rewardsViewMode: "list" }));

		expect(restored).toEqual({ rewardsViewMode: "list" });
	});
});

describe("selectPreferences", () => {
	it("persists the rewards view mode", () => {
		expect(selectPreferences({ rewardsViewMode: "list" })).toEqual({ rewardsViewMode: "list" });
	});
});

describe("UiPreferencesSchema", () => {
	it("accepts the current snapshot", () => {
		expect(UiPreferencesSchema.parse({ rewardsViewMode: "list" })).toEqual({ rewardsViewMode: "list" });
	});

	it("upgrades the bare view mode string the older view-mode helpers wrote", () => {
		expect(UiPreferencesSchema.parse("list")).toEqual({ rewardsViewMode: "list" });
		expect(UiPreferencesSchema.parse("grid")).toEqual({ rewardsViewMode: "grid" });
	});

	it("rejects tampered values", () => {
		expect(UiPreferencesSchema.safeParse({ rewardsViewMode: "carousel" }).success).toBe(false);
		expect(UiPreferencesSchema.safeParse("carousel").success).toBe(false);
		expect(UiPreferencesSchema.safeParse({}).success).toBe(false);
	});
});

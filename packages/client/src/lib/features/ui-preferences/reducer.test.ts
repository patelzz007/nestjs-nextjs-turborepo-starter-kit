import { describe, expect, it } from "vitest";

import { uiPreferencesActions } from "./actions";
import { uiPreferencesReducer } from "./reducer";
import { selectPreferences, selectRewardsViewMode } from "./selectors";
import { UNVERSIONED_STORAGE_FORMAT } from "../../state/feature-persistence";
import { INITIAL_UI_PREFERENCES_STATE, UiPreferencesSchema } from "./state";
import { uiPreferencesPersistence } from "./store";

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

	it("rejects tampered values and the legacy bare string (that format is read only by the migration step)", () => {
		expect(UiPreferencesSchema.safeParse({ rewardsViewMode: "carousel" }).success).toBe(false);
		expect(UiPreferencesSchema.safeParse("list").success).toBe(false);
		expect(UiPreferencesSchema.safeParse({}).success).toBe(false);
	});
});

describe("uiPreferencesPersistence migrations", () => {
	const [unversioned] = uiPreferencesPersistence("key").migrations;

	it("has exactly one step, from unversioned data", () => {
		expect(uiPreferencesPersistence("key").migrations.map((step) => step.fromVersion)).toEqual([UNVERSIONED_STORAGE_FORMAT]);
	});

	it("upgrades the bare view mode string the older view-mode helpers wrote", () => {
		expect(unversioned?.upgrade("list")).toEqual({ rewardsViewMode: "list" });
		expect(unversioned?.upgrade("grid")).toEqual({ rewardsViewMode: "grid" });
	});

	it("upgrades the first feature store's unversioned JSON snapshot, and rejects anything else", () => {
		expect(unversioned?.upgrade(JSON.stringify({ rewardsViewMode: "list" }))).toEqual({ rewardsViewMode: "list" });
		expect(unversioned?.upgrade("carousel")).toBeNull();
		expect(unversioned?.upgrade(JSON.stringify({ rewardsViewMode: "carousel" }))).toBeNull();
	});
});

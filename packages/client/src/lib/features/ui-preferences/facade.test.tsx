// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { UiPreferencesStoreProvider, useRewardsViewMode, useUiPreferencesCommands, type RewardsViewMode } from "./facade";

const STORAGE_KEY = "test-ui-preferences";

function wrapper({ children }: { readonly children: React.ReactNode }): React.JSX.Element {
	return (
		<UiPreferencesStoreProvider storageKey={STORAGE_KEY} devtoolsName="UI Preferences · test">
			{children}
		</UiPreferencesStoreProvider>
	);
}

interface UiPreferencesProbe {
	readonly rewardsViewMode: RewardsViewMode;
	readonly commands: ReturnType<typeof useUiPreferencesCommands>;
}

function useUiPreferencesProbe(): UiPreferencesProbe {
	return { rewardsViewMode: useRewardsViewMode(), commands: useUiPreferencesCommands() };
}

beforeEach((): void => {
	window.localStorage.clear();
});

afterEach((): void => {
	cleanup();
	window.localStorage.clear();
});

describe("UI preferences facade", () => {
	it("exposes the rewards view mode through a narrow hook and changes it through commands", () => {
		const { result } = renderHook(useUiPreferencesProbe, { wrapper });
		expect(result.current.rewardsViewMode).toBe("grid");

		act(() => {
			result.current.commands.changeRewardsViewMode("list");
		});

		expect(result.current.rewardsViewMode).toBe("list");
	});

	it("keeps command identities stable across renders", () => {
		const { result, rerender } = renderHook(useUiPreferencesCommands, { wrapper });
		const first = result.current;

		rerender();

		expect(result.current).toBe(first);
	});

	it("renders the default first and restores the saved choice after mount, so server and client HTML match", () => {
		window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ rewardsViewMode: "list" }));
		const rendered: RewardsViewMode[] = [];

		const { result } = renderHook(
			(): RewardsViewMode => {
				const mode = useRewardsViewMode();
				rendered.push(mode);
				return mode;
			},
			{ wrapper },
		);

		expect(rendered.at(0)).toBe("grid");
		expect(result.current).toBe("list");
	});

	it("saves changes back as a JSON snapshot", () => {
		const { result } = renderHook(useUiPreferencesProbe, { wrapper });

		act(() => {
			result.current.commands.changeRewardsViewMode("list");
		});

		expect(window.localStorage.getItem(STORAGE_KEY)).toBe(JSON.stringify({ rewardsViewMode: "list" }));
	});

	it("keeps the layout the older view-mode helper saved as a bare string, and upgrades it on the next change", () => {
		window.localStorage.setItem(STORAGE_KEY, "list");

		const { result } = renderHook(useUiPreferencesProbe, { wrapper });
		expect(result.current.rewardsViewMode).toBe("list");

		act(() => {
			result.current.commands.changeRewardsViewMode("grid");
		});
		expect(window.localStorage.getItem(STORAGE_KEY)).toBe(JSON.stringify({ rewardsViewMode: "grid" }));
	});

	it("ignores a garbled or tampered snapshot", () => {
		window.localStorage.setItem(STORAGE_KEY, "{not json");
		const garbled = renderHook(useRewardsViewMode, { wrapper });
		expect(garbled.result.current).toBe("grid");
		cleanup();

		window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ rewardsViewMode: "carousel" }));
		const tampered = renderHook(useRewardsViewMode, { wrapper });
		expect(tampered.result.current).toBe("grid");
	});

	it("gives each provider its own store", () => {
		const first = renderHook(useUiPreferencesProbe, { wrapper });
		const second = renderHook(useUiPreferencesProbe, { wrapper });

		act(() => {
			first.result.current.commands.changeRewardsViewMode("list");
		});

		expect(second.result.current.rewardsViewMode).toBe("grid");
	});

	it("fails loudly outside its provider", () => {
		expect(() => renderHook(useRewardsViewMode)).toThrow(/UI Preferences store is missing/u);
	});
});

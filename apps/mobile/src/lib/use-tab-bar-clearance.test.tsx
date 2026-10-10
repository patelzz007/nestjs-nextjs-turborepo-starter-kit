import { renderHook } from "@testing-library/react-native";
import { BottomTabBarHeightContext } from "expo-router/tabs";
import * as React from "react";

import { useTabBarClearance } from "./use-tab-bar-clearance";

describe("useTabBarClearance", () => {
	it("is the height the tab navigator reports for its bar", async () => {
		const { result } = await renderHook(() => useTabBarClearance(), {
			wrapper: ({ children }: { readonly children: React.ReactNode }): React.JSX.Element => <BottomTabBarHeightContext value={106}>{children}</BottomTabBarHeightContext>,
		});

		expect(result.current).toBe(106);
	});

	it("is nothing outside the tabs, where there is no bar", async () => {
		const { result } = await renderHook(() => useTabBarClearance());

		expect(result.current).toBe(0);
	});
});

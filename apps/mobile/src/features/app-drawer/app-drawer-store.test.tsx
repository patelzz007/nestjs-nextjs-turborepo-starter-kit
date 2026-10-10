import { act, renderHook } from "@testing-library/react-native";
import * as React from "react";

import { appDrawerActions } from "./actions";
import { AppDrawerStoreProvider, useAppDrawerCommands, useAppDrawerOpen } from "./facade";
import { appDrawerReducer } from "./reducer";
import { INITIAL_APP_DRAWER_STATE } from "./state";
import { createAppDrawerStore } from "./store";

describe("appDrawerReducer", () => {
	it("starts closed", () => {
		expect(INITIAL_APP_DRAWER_STATE.isOpen).toBe(false);
		expect(createAppDrawerStore().getState().isOpen).toBe(false);
	});

	it("opens and closes", () => {
		const opened = appDrawerReducer(INITIAL_APP_DRAWER_STATE, appDrawerActions.opened());

		expect(opened.isOpen).toBe(true);
		expect(appDrawerReducer(opened, appDrawerActions.closed()).isOpen).toBe(false);
	});

	it("keeps an open drawer open when opened again", () => {
		const opened = appDrawerReducer(INITIAL_APP_DRAWER_STATE, appDrawerActions.opened());

		expect(appDrawerReducer(opened, appDrawerActions.opened()).isOpen).toBe(true);
	});
});

describe("app drawer facade", () => {
	it("opens and closes the drawer through its commands", async () => {
		const store = createAppDrawerStore();
		const { result } = await renderHook(() => ({ isOpen: useAppDrawerOpen(), commands: useAppDrawerCommands() }), {
			wrapper: ({ children }: { readonly children: React.ReactNode }): React.JSX.Element => <AppDrawerStoreProvider store={store}>{children}</AppDrawerStoreProvider>,
		});

		await act((): void => {
			result.current.commands.opened();
		});
		expect(result.current.isOpen).toBe(true);
		await act((): void => {
			result.current.commands.closed();
		});
		expect(result.current.isOpen).toBe(false);
	});
});

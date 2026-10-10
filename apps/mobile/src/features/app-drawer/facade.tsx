// The app drawer facade: the only module screens import (ADR 023, ADR 038).

import * as React from "react";

import { createFeatureStoreContext } from "../../lib/state/feature-store-context";
import { appDrawerActions, type AppDrawerAction } from "./actions";
import { selectAppDrawerOpen } from "./selectors";
import type { AppDrawerState } from "./state";

const appDrawerContext = createFeatureStoreContext<AppDrawerState, AppDrawerAction>("AppDrawer");

export const AppDrawerStoreProvider = appDrawerContext.provider;

export function useAppDrawerOpen(): boolean {
	return appDrawerContext.useFeatureSelector(selectAppDrawerOpen);
}

export interface AppDrawerCommands {
	readonly opened: () => void;
	readonly closed: () => void;
}

export function useAppDrawerCommands(): AppDrawerCommands {
	const { dispatch } = appDrawerContext.useFeatureStore();
	return React.useMemo(
		(): AppDrawerCommands => ({
			opened: (): void => {
				dispatch(appDrawerActions.opened());
			},
			closed: (): void => {
				dispatch(appDrawerActions.closed());
			},
		}),
		[dispatch],
	);
}

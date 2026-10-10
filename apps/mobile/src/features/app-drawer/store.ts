import { createFeatureStore, type FeatureStore } from "../../lib/state/feature-store";
import type { AppDrawerAction } from "./actions";
import { appDrawerReducer } from "./reducer";
import { INITIAL_APP_DRAWER_STATE, type AppDrawerState } from "./state";

export type AppDrawerStore = FeatureStore<AppDrawerState, AppDrawerAction>;

export function createAppDrawerStore(): AppDrawerStore {
	return createFeatureStore<AppDrawerState, AppDrawerAction>({ initialState: INITIAL_APP_DRAWER_STATE, reducer: appDrawerReducer });
}

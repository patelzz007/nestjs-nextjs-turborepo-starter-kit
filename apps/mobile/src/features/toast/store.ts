import { createFeatureStore, type FeatureStore } from "../../lib/state/feature-store";
import type { ToastAction } from "./actions";
import { toastReducer } from "./reducer";
import { INITIAL_TOAST_STATE, type ToastState } from "./state";

export type ToastStore = FeatureStore<ToastState, ToastAction>;

export function createToastStore(): ToastStore {
	return createFeatureStore<ToastState, ToastAction>({ initialState: INITIAL_TOAST_STATE, reducer: toastReducer });
}

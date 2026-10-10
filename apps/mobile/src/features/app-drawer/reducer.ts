import { assertNever } from "@workspace/shared";

import type { AppDrawerAction } from "./actions";
import type { AppDrawerState } from "./state";

export function appDrawerReducer(state: AppDrawerState, action: AppDrawerAction): AppDrawerState {
	switch (action.type) {
		case "[ App Drawer ] Opened":
			return { ...state, isOpen: true };
		case "[ App Drawer ] Closed":
			return { ...state, isOpen: false };
		default:
			return assertNever(action, "app drawer action");
	}
}

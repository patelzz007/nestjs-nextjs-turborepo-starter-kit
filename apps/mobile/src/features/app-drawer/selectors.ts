import type { AppDrawerState } from "./state";

export function selectAppDrawerOpen(state: AppDrawerState): boolean {
	return state.isOpen;
}

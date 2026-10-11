import type { ToastMessage, ToastState } from "./state";

export function selectCurrentToast(state: ToastState): ToastMessage | null {
	return state.current;
}

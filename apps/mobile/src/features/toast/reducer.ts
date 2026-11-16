import { assertNever } from "@workspace/shared";

import type { ToastAction } from "./actions";
import type { ToastState } from "./state";

const NEXT = 1;

export function toastReducer(state: ToastState, action: ToastAction): ToastState {
	switch (action.type) {
		case "[ Toast ] Shown":
			return { current: { id: state.nextId, tone: action.tone, message: action.message, options: action.options }, nextId: state.nextId + NEXT };
		case "[ Toast ] Updated":
			// A toast is rewritten in place (a loading toast that settles) and stays where it sits; one already gone stays gone.
			return state.current?.id === action.id
				? {
						...state,
						current: {
							id: action.id,
							tone: action.tone,
							message: action.message,
							options: { ...action.options, position: action.options?.position ?? state.current.options?.position },
						},
					}
				: state;
		case "[ Toast ] Dismissed":
			// A late dismissal of a toast that was already replaced leaves the newer one on show.
			return state.current?.id === action.id ? { ...state, current: null } : state;
		default:
			return assertNever(action, "toast action");
	}
}

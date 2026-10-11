import type { ToastTone } from "./state";

export type ToastAction =
	{ readonly type: "[ Toast ] Shown"; readonly tone: ToastTone; readonly message: string } | { readonly type: "[ Toast ] Dismissed"; readonly id: number };

export const toastActions = {
	shown: (tone: ToastTone, message: string): ToastAction => ({ type: "[ Toast ] Shown", tone, message }),
	dismissed: (id: number): ToastAction => ({ type: "[ Toast ] Dismissed", id }),
};

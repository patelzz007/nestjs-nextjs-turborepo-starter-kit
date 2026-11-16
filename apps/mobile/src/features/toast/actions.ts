import type { ToastOptions, ToastTone } from "./state";

export type ToastAction =
	| { readonly type: "[ Toast ] Shown"; readonly tone: ToastTone; readonly message: string; readonly options?: ToastOptions | undefined }
	| { readonly type: "[ Toast ] Updated"; readonly id: number; readonly tone: ToastTone; readonly message: string; readonly options?: ToastOptions | undefined }
	| { readonly type: "[ Toast ] Dismissed"; readonly id: number };

export const toastActions = {
	shown: (tone: ToastTone, message: string, options?: ToastOptions): ToastAction => ({ type: "[ Toast ] Shown", tone, message, options }),
	updated: (id: number, tone: ToastTone, message: string, options?: ToastOptions): ToastAction => ({ type: "[ Toast ] Updated", id, tone, message, options }),
	dismissed: (id: number): ToastAction => ({ type: "[ Toast ] Dismissed", id }),
};

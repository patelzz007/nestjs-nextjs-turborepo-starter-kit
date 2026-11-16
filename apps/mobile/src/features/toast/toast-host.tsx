// Where the app shell shows toasts (ADR 047): just under the page header,
// across the page, above everything else in the shell. A toast stays for a
// few seconds — a warning or an error longer, so it can be read — then
// dismisses itself; its close button or a swipe up dismisses it at once. Each
// one is announced to screen readers.
//
// A dismissed toast is not removed at once: it is marked leaving, slides out,
// and is removed when its exit has finished. A newer toast slides in while the
// one it replaced slides out.

import * as React from "react";
import { AccessibilityInfo, View } from "react-native";

import { Toast, type ToastEdge } from "@workspace/ui-native/components/toast";
import { useCurrentToast, useToast } from "./facade";
import type { ToastMessage, ToastTone } from "./state";

/** How long a toast stays, by tone: a warning or an error carries what to do next, so it stays longer. */
export const TOAST_DURATION_MS: Readonly<Record<ToastTone, number>> = { default: 4_000, loading: 4_000, success: 3_000, info: 3_000, warning: 5_000, error: 5_000 };

/** How long a toast stays: its own setting (`null` until closed), else its tone's. */
export function toastDurationOf(toast: ToastMessage): number | null {
	const own = toast.options?.durationMs;
	return own === undefined ? TOAST_DURATION_MS[toast.tone] : own;
}

interface ToastEntry {
	readonly toast: ToastMessage;
	readonly leaving: boolean;
}

export interface ToastHostProps {
	/** Where the toast's top sits, in points from the top of the screen (just under the header's controls). */
	readonly top: number;
	/** Where a bottom toast's bottom sits, in points from the bottom of the screen (above the home indicator). */
	readonly bottom: number;
}

export function ToastHost({ top, bottom }: ToastHostProps): React.JSX.Element {
	const bottomOffset = bottom;
	const current = useCurrentToast();
	const { dismissed } = useToast();
	const [entries, setEntries] = React.useState<readonly ToastEntry[]>([]);

	// Follow the store during render (React's documented pattern for state derived from a changing input):
	// a new toast joins and every other one starts leaving; an updated toast is replaced in place; no toast means every one leaves.
	const currentId = current?.id ?? null;
	const isInSync =
		entries.every((entry: ToastEntry): boolean => entry.leaving === (entry.toast.id !== currentId)) &&
		(current === null || entries.some((entry: ToastEntry): boolean => entry.toast === current));
	if (!isInSync) {
		const others = entries.filter((entry: ToastEntry): boolean => entry.toast.id !== currentId).map((entry: ToastEntry): ToastEntry => ({ ...entry, leaving: true }));
		setEntries(current === null ? others : [...others, { toast: current, leaving: false }]);
	}

	React.useEffect((): (() => void) | undefined => {
		if (current === null) {
			return undefined;
		}
		const title = current.options?.title;
		AccessibilityInfo.announceForAccessibility(title === undefined ? current.message : `${title}. ${current.message}`);
		const duration = toastDurationOf(current);
		if (duration === null) {
			return undefined;
		}
		const timer = setTimeout((): void => {
			dismissed(current.id);
		}, duration);
		return (): void => {
			clearTimeout(timer);
		};
	}, [current, dismissed]);

	const removeEntry = React.useCallback((id: number): void => {
		setEntries((all: readonly ToastEntry[]): readonly ToastEntry[] => all.filter((entry: ToastEntry): boolean => entry.toast.id !== id));
	}, []);
	const topStyle = React.useMemo((): { readonly top: number } => ({ top }), [top]);
	const bottomStyle = React.useMemo((): { readonly bottom: number } => ({ bottom: bottomOffset }), [bottomOffset]);
	const atTop = entries.filter((entry: ToastEntry): boolean => entry.toast.options?.position !== "bottom");
	const atBottom = entries.filter((entry: ToastEntry): boolean => entry.toast.options?.position === "bottom");

	return (
		<>
			<View pointerEvents="box-none" className="absolute inset-x-4" style={topStyle}>
				{atTop.map((entry: ToastEntry): React.JSX.Element => (
					<ToastSlot key={entry.toast.id} entry={entry} edge="top" offscreenOffset={top} onDismiss={dismissed} onLeft={removeEntry} />
				))}
			</View>
			<View pointerEvents="box-none" className="absolute inset-x-4" style={bottomStyle}>
				{atBottom.map((entry: ToastEntry): React.JSX.Element => (
					<ToastSlot key={entry.toast.id} entry={entry} edge="bottom" offscreenOffset={bottomOffset} onDismiss={dismissed} onLeft={removeEntry} />
				))}
			</View>
		</>
	);
}

interface ToastSlotProps {
	readonly entry: ToastEntry;
	readonly edge: ToastEdge;
	readonly offscreenOffset: number;
	readonly onDismiss: (id: number) => void;
	readonly onLeft: (id: number) => void;
}

/** One toast, stacked over the others at the same place (the leaving one slides out under the arriving one). */
function ToastSlot({ entry, edge, offscreenOffset, onDismiss, onLeft }: ToastSlotProps): React.JSX.Element {
	const { id, tone, message, options } = entry.toast;
	const dismiss = React.useCallback((): void => {
		onDismiss(id);
	}, [id, onDismiss]);
	const left = React.useCallback((): void => {
		onLeft(id);
	}, [id, onLeft]);
	return (
		<View pointerEvents={entry.leaving ? "none" : "box-none"} className={edge === "top" ? "absolute inset-x-0 top-0" : "absolute inset-x-0 bottom-0"}>
			<Toast
				tone={tone}
				message={message}
				title={options?.title}
				icon={options?.icon}
				leading={options?.leading}
				content={options?.content}
				actions={options?.actions}
				look={options?.look}
				closeButton={options?.closeButton}
				durationMs={toastDurationOf(entry.toast)}
				edge={edge}
				offscreenOffset={offscreenOffset}
				leaving={entry.leaving}
				onDismiss={dismiss}
				onLeft={left}
				testID={entry.leaving ? "app-toast-leaving" : "app-toast"}
			/>
		</View>
	);
}

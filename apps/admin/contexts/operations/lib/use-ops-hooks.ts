"use client";

// Small hooks the console's screens share.

import * as React from "react";

/** The current time, ticking every `intervalMs` (rendering never reads the clock itself). */
export function useNow(intervalMs: number): number {
	const [now, setNow] = React.useState<number>(() => Date.now());
	React.useEffect(() => {
		const timer = setInterval((): void => {
			setNow(Date.now());
		}, intervalMs);
		return (): void => {
			clearInterval(timer);
		};
	}, [intervalMs]);
	return now;
}

/** A change handler that writes one numeric field of a form's draft. */
export function useNumberField<Draft extends object>(
	setDraft: React.Dispatch<React.SetStateAction<Draft>>,
	key: keyof Draft,
): (event: React.ChangeEvent<HTMLInputElement>) => void {
	return React.useCallback(
		(event: React.ChangeEvent<HTMLInputElement>): void => {
			const value = Number(event.target.value);
			setDraft((current) => ({ ...current, [key]: value }));
		},
		[setDraft, key],
	);
}

/** A change handler that writes a text value. */
export function useTextField(setValue: React.Dispatch<React.SetStateAction<string>>): (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void {
	return React.useCallback(
		(event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>): void => {
			setValue(event.target.value);
		},
		[setValue],
	);
}

/** A handler that closes a dialog when it reports it closed. */
export function useCloseOnDismiss(onClose: () => void): (open: boolean) => void {
	return React.useCallback(
		(open: boolean): void => {
			if (!open) {
				onClose();
			}
		},
		[onClose],
	);
}

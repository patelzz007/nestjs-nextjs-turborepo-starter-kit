// The platform's own list picker, where it has one. React Native gives iOS its
// action sheet (system-picker.ios.ts); other platforms have none, so this
// answers that it showed nothing and the caller draws the kit's own sheet.

/** What the system picker lists, and what to call back with. */
export interface SystemPickerRequest {
	readonly title: string;
	readonly options: readonly string[];
	readonly cancel: string;
	/** Positions in `options` that cannot be picked. */
	readonly disabledIndices: readonly number[];
	/** The picked option's position; not called when the picker is dismissed. */
	readonly onPick: (index: number) => void;
}

/** Shows the system picker and returns `true`, or returns `false` where the platform has none. */
export function showSystemPicker(_request: SystemPickerRequest): boolean {
	return false;
}

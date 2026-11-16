// iOS: the system action sheet lists the options (see system-picker.ts).

import { ActionSheetIOS } from "react-native";

import type { SystemPickerRequest } from "./system-picker";

export type { SystemPickerRequest } from "./system-picker";

/** The system action sheet this module drives: the one place the iOS-only API is named (its tests watch it here). */
export const IOS_ACTION_SHEET: typeof ActionSheetIOS = ActionSheetIOS;

/** Shows the iOS action sheet; the cancel button is its last row. */
export function showSystemPicker({ title, options, cancel, disabledIndices, onPick }: SystemPickerRequest): boolean {
	IOS_ACTION_SHEET.showActionSheetWithOptions(
		{ title, options: [...options, cancel], cancelButtonIndex: options.length, disabledButtonIndices: [...disabledIndices] },
		(index: number): void => {
			if (index < options.length) {
				onPick(index);
			}
		},
	);
	return true;
}

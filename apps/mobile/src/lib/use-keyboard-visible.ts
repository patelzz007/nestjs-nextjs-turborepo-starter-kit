// Whether the on-screen keyboard is open. iOS announces it before it moves
// (`will`), Android only after (`did`); each platform listens to the earliest
// event it sends, so chrome that hides for the keyboard leaves in step with it.

import * as React from "react";
import { Keyboard, Platform, type KeyboardEventName } from "react-native";

const SHOW_EVENT = Platform.select<KeyboardEventName>({ ios: "keyboardWillShow", default: "keyboardDidShow" });
const HIDE_EVENT = Platform.select<KeyboardEventName>({ ios: "keyboardWillHide", default: "keyboardDidHide" });

export function useKeyboardVisible(): boolean {
	const [visible, setVisible] = React.useState((): boolean => Keyboard.isVisible());

	React.useEffect((): (() => void) => {
		const shown = Keyboard.addListener(SHOW_EVENT, (): void => {
			setVisible(true);
		});
		const hidden = Keyboard.addListener(HIDE_EVENT, (): void => {
			setVisible(false);
		});
		return (): void => {
			shown.remove();
			hidden.remove();
		};
	}, []);

	return visible;
}

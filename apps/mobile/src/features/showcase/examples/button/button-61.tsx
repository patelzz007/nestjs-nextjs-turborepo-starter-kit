import MoonIcon from "lucide-react-native/icons/moon";
import SunIcon from "lucide-react-native/icons/sun";
import { IconButton } from "@workspace/ui-native/components/icon-button";
import * as React from "react";
import { Uniwind, useUniwind } from "uniwind";

export function Button61Example(): React.JSX.Element {
	const { theme } = useUniwind();
	const toggle = React.useCallback((): void => {
		Uniwind.setTheme(theme === "dark" ? "light" : "dark");
	}, [theme]);
	return <IconButton icon={theme === "dark" ? SunIcon : MoonIcon} label={theme === "dark" ? "Switch to light" : "Switch to dark"} onPress={toggle} />;
}

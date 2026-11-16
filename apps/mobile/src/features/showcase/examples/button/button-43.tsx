import MenuIcon from "lucide-react-native/icons/menu";
import XIcon from "lucide-react-native/icons/x";
import { IconButton } from "@workspace/ui-native/components/icon-button";
import * as React from "react";

export function Button43Example(): React.JSX.Element {
	const [open, setOpen] = React.useState<boolean>(false);
	const toggle = React.useCallback((): void => {
		setOpen((isOpen: boolean): boolean => !isOpen);
	}, []);
	return (
		<IconButton icon={open ? XIcon : MenuIcon} label={open ? "Close the menu" : "Open the menu"} accessibilityHint={open ? "The menu is open" : undefined} onPress={toggle} />
	);
}

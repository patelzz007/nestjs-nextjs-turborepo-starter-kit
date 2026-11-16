import { Icon } from "@workspace/ui-native/components/icon";
import { Marker, MarkerContent, MarkerIcon } from "@workspace/ui-native/components/marker";
import TerminalIcon from "lucide-react-native/icons/terminal";
import * as React from "react";

// "This one" leans on the glyph, which screen readers never hear.
const LINE = "Ran this one";

export function MarkerDont1Example(): React.JSX.Element {
	return (
		<Marker>
			<MarkerIcon>
				<Icon icon={TerminalIcon} size="sm" colorClassName="accent-muted-foreground" />
			</MarkerIcon>
			<MarkerContent>{LINE}</MarkerContent>
		</Marker>
	);
}

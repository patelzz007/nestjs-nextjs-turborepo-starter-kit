import { Icon } from "@workspace/ui-native/components/icon";
import { Marker, MarkerContent, MarkerIcon } from "@workspace/ui-native/components/marker";
import TerminalIcon from "lucide-react-native/icons/terminal";
import * as React from "react";

const LINE = "Ran pnpm test rate-limit";

export function MarkerDo1Example(): React.JSX.Element {
	return (
		<Marker>
			<MarkerIcon>
				<Icon icon={TerminalIcon} size="sm" colorClassName="accent-muted-foreground" />
			</MarkerIcon>
			<MarkerContent>{LINE}</MarkerContent>
		</Marker>
	);
}

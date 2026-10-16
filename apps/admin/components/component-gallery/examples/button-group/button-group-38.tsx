import * as React from "react";
import { PlayIcon, SkipBackIcon, SkipForwardIcon } from "lucide-react";
import { Button } from "@workspace/ui/components/button";
import { ButtonGroup } from "@workspace/ui/components/button-group";

export function ButtonGroup38Example(): React.JSX.Element {
	return (
		<ButtonGroup>
			<Button variant="outline" size="icon" aria-label="Skip back">
				<SkipBackIcon aria-hidden="true" />
			</Button>
			<Button variant="outline" size="icon" aria-label="Play">
				<PlayIcon aria-hidden="true" />
			</Button>
			<Button variant="outline" size="icon" aria-label="Skip forward">
				<SkipForwardIcon aria-hidden="true" />
			</Button>
		</ButtonGroup>
	);
}

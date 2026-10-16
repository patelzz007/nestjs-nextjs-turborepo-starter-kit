import * as React from "react";
import { PlayIcon } from "lucide-react";
import { Button } from "@workspace/ui/components/button";

export function Button26Example(): React.JSX.Element {
	return (
		<Button size="icon-lg" aria-label="Play">
			<PlayIcon aria-hidden="true" />
		</Button>
	);
}

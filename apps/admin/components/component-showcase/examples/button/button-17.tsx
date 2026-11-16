import * as React from "react";
import { ExternalLinkIcon } from "lucide-react";
import { Button } from "@workspace/ui/components/button";

export function Button17Example(): React.JSX.Element {
	return (
		<Button variant="secondary">
			Open Project
			<ExternalLinkIcon aria-hidden="true" />
		</Button>
	);
}

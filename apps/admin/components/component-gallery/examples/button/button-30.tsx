import * as React from "react";
import { ZapIcon } from "lucide-react";
import { Button } from "@workspace/ui/components/button";

export function Button30Example(): React.JSX.Element {
	return (
		<Button size="lg">
			<ZapIcon aria-hidden="true" />
			Upgrade Now
		</Button>
	);
}

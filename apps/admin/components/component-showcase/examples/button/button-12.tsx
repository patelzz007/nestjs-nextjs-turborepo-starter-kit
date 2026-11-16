import * as React from "react";
import { ArrowRightIcon } from "lucide-react";
import { Button } from "@workspace/ui/components/button";

export function Button12Example(): React.JSX.Element {
	return (
		<Button>
			Get Started
			<ArrowRightIcon aria-hidden="true" />
		</Button>
	);
}

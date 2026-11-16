import * as React from "react";
import { SendIcon } from "lucide-react";
import { Button } from "@workspace/ui/components/button";

export function Button31Example(): React.JSX.Element {
	return (
		<Button size="lg">
			Send Message
			<SendIcon aria-hidden="true" />
		</Button>
	);
}

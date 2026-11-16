import * as React from "react";
import { IconStack } from "@workspace/ui/components/icon-stack";

export function IconStackDont2Example(): React.JSX.Element {
	return (
		<IconStack aria-hidden="true">
			<span className="text-[0.5rem] leading-tight">No new messages from your team</span>
		</IconStack>
	);
}

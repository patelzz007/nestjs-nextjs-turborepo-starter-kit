import * as React from "react";
import { IconStack } from "@workspace/ui/components/icon-stack";
import { InboxIcon } from "lucide-react";

export function IconStackDo2Example(): React.JSX.Element {
	return (
		<IconStack aria-hidden="true">
			<InboxIcon className="size-4" />
		</IconStack>
	);
}

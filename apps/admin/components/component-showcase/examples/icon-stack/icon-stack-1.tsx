import * as React from "react";
import { LayersIcon } from "lucide-react";
import { IconStack } from "@workspace/ui/components/icon-stack";

export function IconStack1Example(): React.JSX.Element {
	return (
		<div className="flex items-center justify-center">
			<IconStack aria-hidden="true">
				<LayersIcon className="size-4" />
			</IconStack>
		</div>
	);
}

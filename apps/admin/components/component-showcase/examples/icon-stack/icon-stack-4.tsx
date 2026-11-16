import * as React from "react";
import { CheckIcon } from "lucide-react";
import { IconStack } from "@workspace/ui/components/icon-stack";

export function IconStack4Example(): React.JSX.Element {
	return (
		<div className="flex items-center justify-center">
			<IconStack aria-hidden="true" className="h-24 w-22 text-primary">
				<span className="flex size-8 items-center justify-center rounded-full border bg-background text-primary shadow-xs">
					<CheckIcon className="size-4" />
				</span>
			</IconStack>
		</div>
	);
}

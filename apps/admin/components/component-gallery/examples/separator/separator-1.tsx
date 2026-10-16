import * as React from "react";
import { Separator } from "@workspace/ui/components/separator";

export function Separator1Example(): React.JSX.Element {
	return (
		<div className="mx-auto flex w-full max-w-xs flex-col gap-2 text-sm">
			<div className="flex flex-col gap-1">
				<div className="text-sm leading-none font-medium">Design System</div>
				<div className="text-xs text-muted-foreground">The Foundation for your UI.</div>
			</div>
			<Separator />
			<div className="text-muted-foreground">A set of beautifully designed components that you can customize, extend, and build on.</div>
		</div>
	);
}

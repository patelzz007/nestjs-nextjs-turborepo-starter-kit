import * as React from "react";
import { Separator } from "@workspace/ui/components/separator";

export function Separator5Example(): React.JSX.Element {
	return (
		<div className="mx-auto flex w-full max-w-xs flex-col gap-6">
			<div className="relative">
				<Separator />
				<span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-background px-2 text-xs text-muted-foreground">or continue with</span>
			</div>
		</div>
	);
}

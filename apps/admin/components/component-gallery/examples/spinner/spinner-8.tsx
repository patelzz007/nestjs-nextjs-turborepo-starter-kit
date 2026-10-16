import * as React from "react";
import { Card, CardContent } from "@workspace/ui/components/card";
import { Spinner } from "@workspace/ui/components/spinner";

export function Spinner8Example(): React.JSX.Element {
	return (
		<Card className="min-h-[200px] w-full max-w-xs">
			<CardContent className="flex grow flex-col items-center justify-center gap-4">
				<Spinner className="size-4 opacity-50" />
				<div className="flex flex-col items-center gap-1">
					<p className="text-sm font-medium">Setting up your workspace</p>
					<p className="text-xs text-muted-foreground">This may take a few seconds...</p>
				</div>
			</CardContent>
		</Card>
	);
}

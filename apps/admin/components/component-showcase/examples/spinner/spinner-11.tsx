import * as React from "react";
import { Card, CardContent } from "@workspace/ui/components/card";
import { Spinner } from "@workspace/ui/components/spinner";

export function Spinner11Example(): React.JSX.Element {
	return (
		<Card className="relative w-full max-w-xs">
			<CardContent className="space-y-3 p-4">
				<h3 className="text-sm font-semibold">Dashboard Overview</h3>
				<p className="text-sm text-muted-foreground">Monthly revenue and user statistics for the current period.</p>
				<div className="grid grid-cols-2 gap-4">
					<div className="rounded-md border p-3">
						<p className="text-xs text-muted-foreground">Revenue</p>
						<p className="text-lg font-bold">$12,450</p>
					</div>
					<div className="rounded-md border p-3">
						<p className="text-xs text-muted-foreground">Users</p>
						<p className="text-lg font-bold">1,234</p>
					</div>
				</div>
			</CardContent>

			{/* Overlay */}
			<Card className="absolute inset-0 z-10 flex items-center justify-center bg-background/80 backdrop-blur-xs">
				<CardContent className="flex grow flex-col items-center justify-center gap-2">
					<Spinner className="size-4 opacity-60" />
				</CardContent>
			</Card>
		</Card>
	);
}

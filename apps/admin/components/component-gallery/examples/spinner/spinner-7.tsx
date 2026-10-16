import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card";
import { Spinner } from "@workspace/ui/components/spinner";

export function Spinner7Example(): React.JSX.Element {
	return (
		<div className="w-full max-w-xs overflow-hidden">
			{/* Card */}
			<Card>
				<CardHeader>
					<CardTitle>Monthly Report</CardTitle>
					<CardDescription>Revenue and growth metrics.</CardDescription>
				</CardHeader>
				<CardContent className="space-y-3">
					<div className="flex items-center justify-between text-sm">
						<span className="text-muted-foreground">Revenue</span>
						<span className="font-medium">$12,450</span>
					</div>
					<div className="flex items-center justify-between text-sm">
						<span className="text-muted-foreground">Growth</span>
						<span className="font-medium">+18.2%</span>
					</div>
					<div className="flex items-center justify-between text-sm">
						<span className="text-muted-foreground">Users</span>
						<span className="font-medium">1,248</span>
					</div>
				</CardContent>
			</Card>

			{/* Overlay */}
			<Card className="absolute inset-0 z-10 bg-background/80 backdrop-blur-xs">
				<CardContent className="flex grow flex-col items-center justify-center gap-2">
					<Spinner className="size-5 opacity-60" />
					<span className="text-sm text-muted-foreground">Refreshing data...</span>
				</CardContent>
			</Card>
		</div>
	);
}

import * as React from "react";
import { SquareTerminalIcon } from "lucide-react";
import { cn } from "@workspace/ui/lib/core/utils";
import { Card, CardContent } from "@workspace/ui/components/card";

const stats = [
	{ label: "Environment", value: "Production" },
	{ label: "Region", value: "us-east-1" },
	{ label: "Version", value: "v2.4.0" },
	{ label: "Status", value: "Healthy" },
];

export function Card14Example(): React.JSX.Element {
	return (
		<Card className="mx-auto w-full max-w-xs overflow-hidden p-0">
			<CardContent className="flex flex-col items-center p-0">
				{/* Header with gradient */}
				<div className="flex w-full flex-col items-center justify-center bg-linear-to-b from-tone-violet-soft/80 to-transparent py-12">
					<div className="relative mb-6">
						<div className="absolute inset-0 scale-150 rounded-full bg-tone-violet/10 blur-2xl" />
						<SquareTerminalIcon aria-hidden="true" className="relative size-16 text-tone-violet" strokeWidth={1.5} />
					</div>
					<h3 className="text-lg font-semibold text-foreground">Deployment Successful</h3>
					<p className="text-sm text-muted-foreground">Your app is now live</p>
				</div>

				{/* Status Rows */}
				<div className="w-full space-y-1 px-4 pb-6">
					{stats.map((item, index) => (
						<div key={item.label} className={cn("flex items-center justify-between rounded-lg px-3 py-2.5", index % 2 === 0 && "bg-muted/40")}>
							<span className="text-sm font-medium text-foreground">{item.label}</span>
							<span className="text-sm text-muted-foreground">{item.value}</span>
						</div>
					))}
				</div>
			</CardContent>
		</Card>
	);
}

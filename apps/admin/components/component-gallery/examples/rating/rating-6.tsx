import * as React from "react";
import { Rating } from "@workspace/ui/components/rating";

import { Progress } from "@workspace/ui/components/progress";
import { Separator } from "@workspace/ui/components/separator";

const distribution = [
	{ stars: 5, count: 124, percentage: 62 },
	{ stars: 4, count: 45, percentage: 22 },
	{ stars: 3, count: 18, percentage: 9 },
	{ stars: 2, count: 8, percentage: 4 },
	{ stars: 1, count: 5, percentage: 3 },
];

export function Rating6Example(): React.JSX.Element {
	return (
		<div className="mx-auto w-full max-w-xs space-y-4">
			<div className="flex flex-col items-center gap-2">
				<span className="text-3xl font-semibold">4.6</span>
				<Rating rating={4.6} size="sm" />
				<span className="text-xs text-muted-foreground">Based on 200 reviews</span>
			</div>
			<Separator />
			<div className="space-y-2">
				{distribution.map((row) => (
					<div key={row.stars} className="flex items-center gap-3 text-sm">
						<span className="w-3 text-right text-xs text-muted-foreground">{row.stars}</span>
						<Progress value={row.percentage} className="flex-1 **:data-[slot=progress-indicator]:bg-warning **:data-[slot=progress-track]:h-1.5" />
						<span className="w-7 text-right text-xs text-muted-foreground">{row.count}</span>
					</div>
				))}
			</div>
		</div>
	);
}

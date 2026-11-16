import * as React from "react";
import { SparklesIcon } from "lucide-react";
import { IconStack } from "@workspace/ui/components/icon-stack";

const stacks = [
	{
		label: "Neutral",
		className: "text-foreground",
		iconClassName: "text-muted-foreground",
	},
	{
		label: "Primary",
		className: "text-primary",
		iconClassName: "text-primary",
	},
	{
		label: "Success",
		className: "text-success",
		iconClassName: "text-success",
	},
	{
		label: "Warning",
		className: "text-warning",
		iconClassName: "text-warning",
	},
];

export function IconStack3Example(): React.JSX.Element {
	return (
		<div className="flex flex-wrap items-end justify-center gap-7">
			{stacks.map((item) => (
				<div key={item.label} className="flex flex-col items-center gap-2">
					<IconStack aria-hidden="true" className={item.className}>
						<SparklesIcon className={`size-4 ${item.iconClassName}`} />
					</IconStack>
					<span className="text-sm text-muted-foreground">{item.label}</span>
				</div>
			))}
		</div>
	);
}

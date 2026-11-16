import * as React from "react";
import { ArchiveIcon, LayersIcon, PackageIcon } from "lucide-react";
import { IconStack } from "@workspace/ui/components/icon-stack";

const sizes = [
	{
		label: "Small",
		className: "h-16 w-14",
		icon: <ArchiveIcon className="size-3.5" />,
	},
	{
		label: "Default",
		className: "h-20 w-18",
		icon: <PackageIcon className="size-4" />,
	},
	{
		label: "Large",
		className: "h-28 w-24",
		icon: <LayersIcon className="size-6" />,
	},
];

export function IconStack2Example(): React.JSX.Element {
	return (
		<div className="flex flex-wrap items-end justify-center gap-8">
			{sizes.map((item) => (
				<div key={item.label} className="flex flex-col items-center gap-2">
					<IconStack aria-hidden="true" className={item.className}>
						{item.icon}
					</IconStack>
					<span className="text-sm text-muted-foreground">{item.label}</span>
				</div>
			))}
		</div>
	);
}

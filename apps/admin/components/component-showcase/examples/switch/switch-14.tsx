import * as React from "react";
import { BarChart3Icon, BugIcon, DatabaseIcon, GlobeIcon } from "lucide-react";
import { Field, FieldContent, FieldGroup, FieldLabel, FieldTitle } from "@workspace/ui/components/field";
import { Switch } from "@workspace/ui/components/switch";

const features = [
	{
		id: "feat-analytics",
		title: "Analytics",
		description: "Track page views and user interactions",
		checked: true,
		icon: <BarChart3Icon aria-hidden="true" className="size-4" />,
	},
	{
		id: "feat-logging",
		title: "Error Logging",
		description: "Capture and report runtime errors",
		checked: true,
		icon: <BugIcon aria-hidden="true" className="size-4" />,
	},
	{
		id: "feat-cdn",
		title: "CDN Caching",
		description: "Serve static assets from edge network",
		checked: false,
		icon: <GlobeIcon aria-hidden="true" className="size-4" />,
	},
	{
		id: "feat-backup",
		title: "Auto Backup",
		description: "Daily snapshots of your database",
		checked: false,
		icon: <DatabaseIcon aria-hidden="true" className="size-4" />,
	},
];

export function Switch14Example(): React.JSX.Element {
	return (
		<FieldGroup className="grid w-full max-w-md grid-cols-2 gap-4">
			{features.map((feature) => (
				<FieldLabel key={feature.id} htmlFor={feature.id} className="p-0!">
					<Field orientation="horizontal">
						<FieldContent>
							<FieldTitle className="flex items-start gap-2">
								<div className="flex shrink-0 items-center justify-center rounded-md border border-border bg-background p-1.5 shadow-xs shadow-scrim/5">{feature.icon}</div>
								<div className="flex flex-col items-start gap-0.5">
									<span className="text-sm font-semibold">{feature.title}</span>
									<span className="text-xs text-muted-foreground">{feature.description}</span>
								</div>
							</FieldTitle>
						</FieldContent>
						<Switch id={feature.id} defaultChecked={feature.checked} size="sm" />
					</Field>
				</FieldLabel>
			))}
		</FieldGroup>
	);
}

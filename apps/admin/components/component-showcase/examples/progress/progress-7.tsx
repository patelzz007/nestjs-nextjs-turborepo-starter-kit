import * as React from "react";
import { CircleCheckIcon, CircleIcon } from "lucide-react";
import { Progress } from "@workspace/ui/components/progress";

const steps = [
	{ label: "Account", completed: true },
	{ label: "Profile", completed: true },
	{ label: "Preferences", completed: false },
	{ label: "Review", completed: false },
];

export function Progress7Example(): React.JSX.Element {
	const completedSteps = steps.filter((s) => s.completed).length;
	const progressValue = (completedSteps / steps.length) * 100;

	return (
		<div className="mx-auto w-full max-w-xs space-y-4">
			<div className="flex items-center justify-between">
				<span className="text-sm font-medium">Setup Progress</span>
				<span className="text-xs text-muted-foreground">
					{completedSteps} of {steps.length} steps
				</span>
			</div>
			<Progress value={progressValue} />
			<div className="flex flex-col gap-2">
				{steps.map((step) => (
					<div key={step.label} className="flex items-center gap-2 text-sm">
						{step.completed ? (
							<CircleCheckIcon className="size-4 text-success" aria-hidden="true" />
						) : (
							<CircleIcon className="size-4 text-muted-foreground" aria-hidden="true" />
						)}
						<span className={step.completed ? "text-foreground" : "text-muted-foreground"}>{step.label}</span>
					</div>
				))}
			</div>
		</div>
	);
}

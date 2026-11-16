"use client";

import * as React from "react";
import { ArrowLeftIcon, ArrowRightIcon, CompassIcon } from "lucide-react";
import { useCallback, useState } from "react";

import { Button } from "@workspace/ui/components/button";
import { Popover, PopoverContent, PopoverTrigger } from "@workspace/ui/components/popover";

interface TourStep {
	readonly title: string;
	readonly description: string;
}

const FIRST_STEP: TourStep = {
	title: "Invite Your Team",
	description: "Add team members by email to collaborate on projects in real time. Assign roles and manage permissions from the team settings.",
};

const steps: readonly TourStep[] = [
	FIRST_STEP,
	{
		title: "Create a Project",
		description: "Set up your first project with a name, description, and timeline. Choose from templates or start from scratch.",
	},
	{
		title: "Connect Integrations",
		description: "Link tools like GitHub, Slack, and Figma to streamline your workflow and keep everything in sync.",
	},
	{
		title: "Set Up Notifications",
		description: "Customize which events trigger alerts — mentions, due dates, status changes, and deployment updates.",
	},
];

const FIRST_INDEX = 0;
const LAST_INDEX = steps.length - 1;

export function Popover11Example(): React.JSX.Element {
	const [currentStep, setCurrentStep] = useState(FIRST_INDEX);

	const handleNext = useCallback((): void => {
		setCurrentStep((index: number): number => Math.min(index + 1, LAST_INDEX));
	}, []);

	const handlePrev = useCallback((): void => {
		setCurrentStep((index: number): number => Math.max(index - 1, FIRST_INDEX));
	}, []);

	const isFirst = currentStep === FIRST_INDEX;
	const isLast = currentStep === LAST_INDEX;
	const step = steps.at(currentStep) ?? FIRST_STEP;

	return (
		<div className="flex min-h-[100px] items-center justify-center">
			<Popover>
				<PopoverTrigger render={<Button variant="outline" />}>
					<CompassIcon aria-hidden="true" />
					Feature Tour
				</PopoverTrigger>
				<PopoverContent className="w-72 gap-2 px-3 pt-3 pb-2" side="top" sideOffset={8}>
					<div className="space-y-2">
						<p className="leading-tight font-medium">{step.title}</p>
						<p className="text-muted-foreground">{step.description}</p>
					</div>
					<div className="flex items-center justify-between">
						<span className="text-muted-foreground">
							{String(currentStep + 1)} of {String(steps.length)}
						</span>
						<div className="flex gap-0.5">
							<Button aria-label="Previous step" className="size-6" disabled={isFirst} onClick={handlePrev} size="icon" variant="ghost">
								<ArrowLeftIcon className="size-3.5" aria-hidden="true" />
							</Button>
							<Button aria-label="Next step" className="size-6" disabled={isLast} onClick={handleNext} size="icon" variant="ghost">
								<ArrowRightIcon className="size-3.5" aria-hidden="true" />
							</Button>
						</div>
					</div>
				</PopoverContent>
			</Popover>
		</div>
	);
}

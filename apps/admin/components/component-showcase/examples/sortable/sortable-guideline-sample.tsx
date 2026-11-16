"use client";

// The list the Do / Don't pairs show: steps reordered by a grip, the grip named for its step or not, at a size a
// pointer or a finger can hit or too small to.

import { Sortable, SortableItem, SortableItemHandle } from "@workspace/ui/components/sortable";
import { cn } from "@workspace/ui/lib/core/utils";
import { GripVerticalIcon } from "lucide-react";
import * as React from "react";

interface Step {
	readonly id: string;
	readonly title: string;
}

const STEPS: Step[] = [
	{ id: "build", title: "Build the app" },
	{ id: "test", title: "Run the tests" },
	{ id: "deploy", title: "Deploy to production" },
];

function stepId(step: Step): string {
	return step.id;
}

export interface GuidelineSortableProps {
	/** Each grip says which step it moves. */
	readonly named: boolean;
	/** The grip keeps a target of at least 24 by 24 pixels. */
	readonly roomyGrip: boolean;
}

export function GuidelineSortable({ named, roomyGrip }: GuidelineSortableProps): React.JSX.Element {
	const [steps, setSteps] = React.useState<Step[]>(STEPS);
	return (
		<Sortable value={steps} onValueChange={setSteps} getItemValue={stepId} strategy="vertical" className="flex w-full max-w-xs flex-col gap-2">
			{steps.map((step: Step): React.JSX.Element => (
				<SortableItem key={step.id} value={step.id}>
					<div className="flex items-center gap-2 rounded-md border bg-background p-2 text-sm">
						<SortableItemHandle
							aria-label={named ? `Reorder ${step.title}` : undefined}
							className={cn("flex items-center justify-center text-muted-foreground", roomyGrip ? "size-8" : "size-3")}>
							<GripVerticalIcon aria-hidden="true" className={roomyGrip ? "size-4" : "size-2.5"} />
						</SortableItemHandle>
						{step.title}
					</div>
				</SortableItem>
			))}
		</Sortable>
	);
}

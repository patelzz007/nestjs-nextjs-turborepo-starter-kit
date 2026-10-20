import type { RewardEditorSectionId } from "@/contexts/rewards/lib/reward-draft";
import { cn } from "@workspace/ui/lib/core/utils";
import * as React from "react";

export interface RewardEditorSectionProps {
	/** The section's anchor — the preview's checklist links here. */
	readonly id: RewardEditorSectionId;
	readonly title: string;
	readonly description?: string;
	readonly children: React.ReactNode;
	readonly className?: string;
}

/**
 * One part of the reward editor's single panel: a heading with a line on what
 * it is for, then its fields. Sections follow each other inside the panel,
 * separated by a hairline, so the form reads as one document instead of a
 * stack of separate cards.
 */
export function RewardEditorSection({ id, title, description, children, className }: RewardEditorSectionProps): React.JSX.Element {
	const headingId = `${id}-heading`;
	return (
		<section
			id={id}
			aria-labelledby={headingId}
			data-slot="reward-editor-section"
			className={cn("flex scroll-mt-24 flex-col gap-5 border-border px-5 py-6 not-first:border-t sm:px-7 sm:py-7", className)}>
			<header className="flex flex-col gap-1">
				<h2 id={headingId} className="text-base font-semibold text-foreground">
					{title}
				</h2>
				{description === undefined ? null : <p className="max-w-prose text-sm text-muted-foreground">{description}</p>}
			</header>
			{children}
		</section>
	);
}

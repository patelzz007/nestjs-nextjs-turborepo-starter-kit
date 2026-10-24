import * as React from "react";

export interface KanbanPageSectionProps {
	/** The block's heading, set like a page heading rather than a card title. */
	readonly title: string;
	/** A quiet note beside the heading ("2 of 3 done"). */
	readonly note?: React.ReactNode;
	/** Actions on the heading's right ("Edit list", "Attach file"). */
	readonly actions?: React.ReactNode;
	readonly children: React.ReactNode;
}

/**
 * One block of an item's page: a heading with an optional note and actions,
 * then its content straight on the page — no card around it, the way a
 * document page stacks its blocks.
 */
export function KanbanPageSection({ title, note, actions, children }: KanbanPageSectionProps): React.JSX.Element {
	const headingId = React.useId();
	return (
		<section aria-labelledby={headingId} className="flex flex-col gap-2">
			<div className="flex min-h-8 items-center justify-between gap-3 border-b pb-1.5">
				<div className="flex min-w-0 items-baseline gap-2">
					<h2 id={headingId} className="text-lg font-semibold tracking-tight">
						{title}
					</h2>
					{note === undefined ? null : <span className="text-sm text-muted-foreground tabular-nums">{note}</span>}
				</div>
				{actions === undefined ? null : <div className="flex shrink-0 items-center gap-1">{actions}</div>}
			</div>
			{children}
		</section>
	);
}

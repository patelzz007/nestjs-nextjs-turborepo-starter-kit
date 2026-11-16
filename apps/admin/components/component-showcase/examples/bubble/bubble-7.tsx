import * as React from "react";
import { Bubble, BubbleContent } from "@workspace/ui/components/bubble";

export function Bubble7Example(): React.JSX.Element {
	return (
		<div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
			<Bubble variant="muted" align="end">
				<BubbleContent>Summarise what changed in 3.4 for the release note.</BubbleContent>
			</Bubble>
			{/* ghost is the only variant with no frame and no 80% cap, which is what
          lets a structured assistant answer use the whole width of the row. */}
			<Bubble variant="ghost">
				<BubbleContent>
					{/* Real elements, not a markdown renderer, so the example installs
              with no parser dependency and never sets raw HTML from a string.
              The block layout sits on this wrapper rather than on BubbleContent,
              which owns its padding, radius and font size in all eight styles. */}
					<div className="flex flex-col gap-3">
						<p>3.4 is a reliability release. Nothing in it changes an API, and three fixes are worth naming in the note.</p>
						<h4 className="font-semibold">What changed</h4>
						{/* No font size on any block child, so lyra still resolves its own
                smaller rung. The one relative size is the em on the code chip. */}
						<ul className="ms-4 list-disc space-y-1 marker:text-muted-foreground">
							<li>
								<strong className="font-medium">Refund webhooks</strong> retry for up to a minute, so a{" "}
								<code className="rounded-sm bg-muted px-1 py-0.5 font-mono text-[0.85em]">charge.refunded</code> event no longer drops when the processor is slow to answer.
							</li>
							<li>
								<strong className="font-medium">Group membership</strong> stays in step with the identity provider, including the removals that used to need a manual resync.
							</li>
							<li>
								<strong className="font-medium">CSV exports</strong> finish at every accepted size. The 250MB ceiling that failed silently is gone.
							</li>
						</ul>
						<p className="text-muted-foreground">
							Everything else is unchanged.{" "}
							<a href="#component-bubble" className="underline underline-offset-4">
								Open the full diff
							</a>
						</p>
					</div>
				</BubbleContent>
			</Bubble>
		</div>
	);
}

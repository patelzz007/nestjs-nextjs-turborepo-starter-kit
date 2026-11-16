import * as React from "react";
import { Button } from "@workspace/ui/components/button";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from "@workspace/ui/components/sheet";

type SheetSide = NonNullable<React.ComponentProps<typeof SheetContent>["side"]>;

const sides: readonly SheetSide[] = ["top", "right", "bottom", "left"];

/** How many placeholder paragraphs fill the sheet. */
const PARAGRAPH_COUNT = 5;
/** A stable id per placeholder paragraph. */
const PARAGRAPH_IDS: readonly string[] = Array.from({ length: PARAGRAPH_COUNT }, (_: undefined, position: number): string => `paragraph-${String(position + 1)}`);

export function Sheet3Example(): React.JSX.Element {
	return (
		<div className="flex flex-wrap items-center justify-center gap-2">
			{sides.map((side: SheetSide): React.JSX.Element => (
				<Sheet key={side}>
					<SheetTrigger render={<Button variant="outline" className="capitalize" />}>{side}</SheetTrigger>
					<SheetContent side={side} className="data-[side=bottom]:max-h-[50vh] data-[side=top]:max-h-[50vh]">
						<SheetHeader>
							<SheetTitle>Sheet Side: {side}</SheetTitle>
							<SheetDescription>This sheet opens from the {side} side of the screen.</SheetDescription>
						</SheetHeader>
						<div className="p-4 text-sm text-muted-foreground">
							{PARAGRAPH_IDS.map((paragraphId: string): React.JSX.Element => (
								<p key={paragraphId} className="mb-2">
									Lorem ipsum dolor sit amet, consectetur adipiscing elit.
								</p>
							))}
						</div>
						<SheetFooter>
							<SheetClose render={<Button variant="outline" />}>Close</SheetClose>
						</SheetFooter>
					</SheetContent>
				</Sheet>
			))}
		</div>
	);
}

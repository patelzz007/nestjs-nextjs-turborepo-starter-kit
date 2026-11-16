import * as React from "react";
import { Button } from "@workspace/ui/components/button";
import { ScrollArea } from "@workspace/ui/components/scroll-area";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from "@workspace/ui/components/sheet";

/** How many placeholder paragraphs fill the sheet. */
const PARAGRAPH_COUNT = 20;
/** A stable id per placeholder paragraph. */
const PARAGRAPH_IDS: readonly string[] = Array.from({ length: PARAGRAPH_COUNT }, (_: undefined, position: number): string => `paragraph-${String(position + 1)}`);

export function Sheet4Example(): React.JSX.Element {
	return (
		<div className="flex items-center justify-center">
			<Sheet>
				<SheetTrigger render={<Button variant="outline" />}>Scrollable Sheet</SheetTrigger>
				<SheetContent className="flex flex-col gap-0 space-y-0">
					<SheetHeader>
						<SheetTitle>Scrollable Content</SheetTitle>
						<SheetDescription>Description of the scrollable content.</SheetDescription>
					</SheetHeader>
					<ScrollArea className="min-h-0 flex-1">
						<div className="space-y-4 px-4">
							{PARAGRAPH_IDS.map((paragraphId: string): React.JSX.Element => (
								<p key={paragraphId} className="text-sm text-muted-foreground">
									Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis
									nostrud exercitation ullamco laboris.
								</p>
							))}
						</div>
					</ScrollArea>
					<SheetFooter>
						<Button type="submit">Save changes</Button>
						<SheetClose render={<Button variant="outline" />}>Cancel</SheetClose>
					</SheetFooter>
				</SheetContent>
			</Sheet>
		</div>
	);
}

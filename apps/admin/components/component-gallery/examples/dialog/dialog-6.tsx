import * as React from "react";
import { Button } from "@workspace/ui/components/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@workspace/ui/components/dialog";

/** How many placeholder paragraphs the example repeats. */
const PARAGRAPH_COUNT = 20;
/** A stable id per placeholder paragraph, used as its key. */
const PARAGRAPH_IDS: readonly string[] = Array.from({ length: PARAGRAPH_COUNT }, (_: undefined, position: number): string => `paragraph-${String(position + 1)}`);

export function Dialog6Example(): React.JSX.Element {
	return (
		<div className="flex items-center justify-center">
			<Dialog>
				<DialogTrigger render={<Button variant="outline" />}>Full Screen Fluid</DialogTrigger>
				<DialogContent className="flex max-h-[calc(100vh-3rem)] w-full max-w-[calc(100vw-3rem)] flex-col overflow-hidden p-0">
					<DialogHeader className="sticky top-0 z-10 border-b bg-background px-6 py-4">
						<DialogTitle>Full Screen Dialog</DialogTitle>
						<DialogDescription>A fluid full-screen dialog with sticky header and footer.</DialogDescription>
					</DialogHeader>
					<div className="me-0.5 flex-1 overflow-auto px-6 [scrollbar-color:rgb(120_120_120/0.4)_transparent] [scrollbar-width:thin]">
						<div className="space-y-4 text-sm">
							{PARAGRAPH_IDS.map((placeholderId: string): React.JSX.Element => (
								<p key={placeholderId} className="leading-normal text-muted-foreground">
									Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis
									nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu
									fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.
								</p>
							))}
						</div>
					</div>
					<DialogFooter className="border-t bg-background px-6 py-4">
						<DialogClose render={<Button variant="outline" />}>Close</DialogClose>
						<DialogClose render={<Button />}>Save changes</DialogClose>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}

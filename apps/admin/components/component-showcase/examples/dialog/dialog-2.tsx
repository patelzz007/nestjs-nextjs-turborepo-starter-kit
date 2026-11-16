import * as React from "react";
import { Button } from "@workspace/ui/components/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@workspace/ui/components/dialog";

/** How many placeholder paragraphs the example repeats. */
const PARAGRAPH_COUNT = 10;
/** A stable id per placeholder paragraph, used as its key. */
const PARAGRAPH_IDS: readonly string[] = Array.from({ length: PARAGRAPH_COUNT }, (_: undefined, position: number): string => `paragraph-${String(position + 1)}`);

export function Dialog2Example(): React.JSX.Element {
	return (
		<div className="flex items-center justify-center">
			<Dialog>
				<DialogTrigger render={<Button variant="outline" />}>Scrollable Content</DialogTrigger>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Scrollable Content</DialogTitle>
						<DialogDescription>This is a dialog with scrollable content.</DialogDescription>
					</DialogHeader>
					<div className="-mx-4 no-scrollbar max-h-[70vh] overflow-y-auto px-4">
						{PARAGRAPH_IDS.map((placeholderId: string): React.JSX.Element => (
							<p key={placeholderId} className="mb-4 leading-normal">
								Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis
								nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu
								fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.
							</p>
						))}
					</div>
				</DialogContent>
			</Dialog>
		</div>
	);
}

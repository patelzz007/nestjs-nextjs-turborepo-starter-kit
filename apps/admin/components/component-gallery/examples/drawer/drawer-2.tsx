import * as React from "react";
import { Button } from "@workspace/ui/components/button";
import { Drawer, DrawerClose, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle, DrawerTrigger } from "@workspace/ui/components/drawer";

/** How many placeholder paragraphs the example repeats. */
const PARAGRAPH_COUNT = 10;
/** A stable id per placeholder paragraph, used as its key. */
const PARAGRAPH_IDS: readonly string[] = Array.from({ length: PARAGRAPH_COUNT }, (_: undefined, position: number): string => `paragraph-${String(position + 1)}`);

export function Drawer2Example(): React.JSX.Element {
	return (
		<div className="flex items-center justify-center">
			<Drawer swipeDirection="right">
				<DrawerTrigger render={<Button variant="outline">Right Drawer</Button>} />
				<DrawerContent>
					<DrawerHeader>
						<DrawerTitle>Move Goal</DrawerTitle>
						<DrawerDescription>Set your daily activity goal.</DrawerDescription>
					</DrawerHeader>
					<div className="no-scrollbar overflow-y-auto px-4">
						{PARAGRAPH_IDS.map((placeholderId: string): React.JSX.Element => (
							<p key={placeholderId} className="mb-4 leading-normal">
								Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis
								nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu
								fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.
							</p>
						))}
					</div>
					<DrawerFooter>
						<Button>Submit</Button>
						<DrawerClose render={<Button variant="outline">Cancel</Button>} />
					</DrawerFooter>
				</DrawerContent>
			</Drawer>
		</div>
	);
}

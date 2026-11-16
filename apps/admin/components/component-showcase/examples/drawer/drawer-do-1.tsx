import * as React from "react";
import { Button } from "@workspace/ui/components/button";
import { Drawer, DrawerClose, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle, DrawerTrigger } from "@workspace/ui/components/drawer";
import { Textarea } from "@workspace/ui/components/textarea";

export function DrawerDo1Example(): React.JSX.Element {
	return (
		<Drawer showSwipeHandle>
			<DrawerTrigger render={<Button variant="outline">Add note</Button>} />
			<DrawerContent>
				<DrawerHeader>
					<DrawerTitle>Delivery note</DrawerTitle>
					<DrawerDescription>The driver sees it on arrival.</DrawerDescription>
				</DrawerHeader>
				<div className="px-4">
					<Textarea aria-label="Note" placeholder="Add a note for the driver" />
				</div>
				<DrawerFooter>
					<DrawerClose render={<Button>Done</Button>} />
				</DrawerFooter>
			</DrawerContent>
		</Drawer>
	);
}

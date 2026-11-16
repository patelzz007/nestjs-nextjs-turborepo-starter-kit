import * as React from "react";
import { Button } from "@workspace/ui/components/button";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from "@workspace/ui/components/sheet";

export function SheetDont1Example(): React.JSX.Element {
	return (
		<Sheet>
			<SheetTrigger render={<Button variant="outline" />}>Archive</SheetTrigger>
			<SheetContent>
				<SheetHeader>
					<SheetTitle>Archive this ticket?</SheetTitle>
					<SheetDescription>You can restore it later.</SheetDescription>
				</SheetHeader>
				<SheetFooter>
					<SheetClose render={<Button />}>Archive</SheetClose>
				</SheetFooter>
			</SheetContent>
		</Sheet>
	);
}

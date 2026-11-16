"use client";

import * as React from "react";
import { CheckIcon } from "lucide-react";
import { useCallback, useState } from "react";

import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogTitle,
	AlertDialogTrigger,
} from "@workspace/ui/components/alert-dialog";
import { Button } from "@workspace/ui/components/button";
import { Checkbox } from "@workspace/ui/components/checkbox";
import { Label } from "@workspace/ui/components/label";

export function AlertDialog7Example(): React.JSX.Element {
	// The base AlertDialogAction does not close the dialog on its own.
	const [open, setOpen] = useState(false);
	const closeDialog = useCallback((): void => {
		setOpen(false);
	}, []);

	return (
		<AlertDialog open={open} onOpenChange={setOpen}>
			<AlertDialogTrigger render={<Button variant="outline">Task Status</Button>} />
			<AlertDialogContent>
				<div className="flex items-center gap-3 py-1">
					<div className="flex size-10 items-center justify-center rounded-full bg-tone-green-soft text-tone-green">
						<CheckIcon className="size-5" />
					</div>
					<div className="flex flex-col justify-center gap-1">
						<AlertDialogTitle className="text-sm font-semibold">Task successful</AlertDialogTitle>
						<AlertDialogDescription className="text-sm text-muted-foreground">Your task has been completed successfully.</AlertDialogDescription>
					</div>
				</div>
				<AlertDialogFooter className="items-center gap-4 sm:justify-between">
					<div className="flex items-center gap-2">
						<Checkbox id="show-again" />
						<Label htmlFor="show-again" className="font-normal text-muted-foreground">
							Don&apos;t show again
						</Label>
					</div>
					<div className="flex items-center gap-2">
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction onClick={closeDialog}>Confirm</AlertDialogAction>
					</div>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}

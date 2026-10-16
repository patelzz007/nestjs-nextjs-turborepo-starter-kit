"use client";

import * as React from "react";
import { useCallback, useState } from "react";

import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from "@workspace/ui/components/alert-dialog";
import { Button } from "@workspace/ui/components/button";

export function AlertDialog2Example(): React.JSX.Element {
	// The base AlertDialogAction does not close the dialog on its own.
	const [open, setOpen] = useState(false);
	const closeDialog = useCallback((): void => {
		setOpen(false);
	}, []);

	return (
		<AlertDialog open={open} onOpenChange={setOpen}>
			<AlertDialogTrigger render={<Button variant="outline">Small Alert</Button>} />
			<AlertDialogContent size="sm">
				<AlertDialogHeader>
					<AlertDialogTitle>Allow accessory to connect?</AlertDialogTitle>
					<AlertDialogDescription>Do you want to allow the USB accessory to connect to this device?</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel>Don&apos;t allow</AlertDialogCancel>
					<AlertDialogAction onClick={closeDialog}>Allow</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}

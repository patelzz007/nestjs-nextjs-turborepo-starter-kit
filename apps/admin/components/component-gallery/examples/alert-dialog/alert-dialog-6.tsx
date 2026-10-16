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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@workspace/ui/components/dialog";

export function AlertDialog6Example(): React.JSX.Element {
	// The base AlertDialogAction does not close the dialog on its own.
	const [open, setOpen] = useState(false);
	const closeDialog = useCallback((): void => {
		setOpen(false);
	}, []);

	return (
		<Dialog>
			<DialogTrigger render={<Button variant="outline" />}>Open Dialog</DialogTrigger>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Alert Dialog Example</DialogTitle>
					<DialogDescription>Click the button below to open an alert dialog.</DialogDescription>
				</DialogHeader>
				<DialogFooter>
					<AlertDialog open={open} onOpenChange={setOpen}>
						<AlertDialogTrigger render={<Button />}>Open Alert Dialog</AlertDialogTrigger>
						<AlertDialogContent size="sm">
							<AlertDialogHeader>
								<AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
								<AlertDialogDescription>This action cannot be undone. This will permanently delete your account and remove your data from our servers.</AlertDialogDescription>
							</AlertDialogHeader>
							<AlertDialogFooter>
								<AlertDialogCancel>Cancel</AlertDialogCancel>
								<AlertDialogAction onClick={closeDialog}>Continue</AlertDialogAction>
							</AlertDialogFooter>
						</AlertDialogContent>
					</AlertDialog>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

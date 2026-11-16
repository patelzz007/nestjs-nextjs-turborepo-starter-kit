"use client";

import * as React from "react";
import { CircleAlertIcon } from "lucide-react";
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

export function AlertDialog8Example(): React.JSX.Element {
	// The base AlertDialogAction does not close the dialog on its own.
	const [open, setOpen] = useState(false);
	const closeDialog = useCallback((): void => {
		setOpen(false);
	}, []);

	return (
		<AlertDialog open={open} onOpenChange={setOpen}>
			<AlertDialogTrigger render={<Button variant="destructive">Deactivate Account</Button>} />
			<AlertDialogContent>
				<div className="flex items-start gap-3 py-1">
					<div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-destructive/10 dark:bg-destructive/10">
						<CircleAlertIcon className="size-5 text-destructive" />
					</div>
					<div className="flex flex-col justify-center gap-1">
						<AlertDialogTitle className="text-sm font-semibold">Deactivate your account?</AlertDialogTitle>
						<AlertDialogDescription className="text-sm text-muted-foreground">
							This will disable your account and remove your profile from all active searches.
						</AlertDialogDescription>
					</div>
				</div>
				<AlertDialogFooter>
					<AlertDialogCancel>Keep My Account</AlertDialogCancel>
					<AlertDialogAction variant="destructive" onClick={closeDialog}>
						Deactivate Anyway
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}

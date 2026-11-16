"use client";

import * as React from "react";
import { ShieldQuestionMarkIcon } from "lucide-react";
import { useCallback, useState } from "react";

import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogMedia,
	AlertDialogTitle,
	AlertDialogTrigger,
} from "@workspace/ui/components/alert-dialog";
import { Button } from "@workspace/ui/components/button";

export function AlertDialog13Example(): React.JSX.Element {
	// The base AlertDialogAction does not close the dialog on its own.
	const [open, setOpen] = useState(false);
	const closeDialog = useCallback((): void => {
		setOpen(false);
	}, []);

	return (
		<AlertDialog open={open} onOpenChange={setOpen}>
			<AlertDialogTrigger render={<Button variant="outline">Logout</Button>} />
			<AlertDialogContent size="sm" className="gap-0 overflow-hidden p-0 sm:max-w-sm">
				<div className="flex flex-col items-center justify-center gap-2 p-8">
					<AlertDialogMedia className="size-12 rounded-full bg-tone-violet-soft text-tone-violet">
						<ShieldQuestionMarkIcon className="size-6" />
					</AlertDialogMedia>
					<AlertDialogTitle className="text-center text-base font-semibold">Are you sure?</AlertDialogTitle>
					<AlertDialogDescription className="p-0 text-center text-sm font-medium">You can always log in later to your account.</AlertDialogDescription>
				</div>
				<AlertDialogFooter className="grid flex-none grid-cols-2 gap-0 divide-x border-t pt-0">
					<AlertDialogCancel variant="ghost" className="h-12 flex-1 rounded-none border-0 border-r border-border p-0">
						No
					</AlertDialogCancel>
					<AlertDialogAction variant="ghost" className="h-12 flex-1 rounded-none border-0 p-0" onClick={closeDialog}>
						Yes, Logout
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}

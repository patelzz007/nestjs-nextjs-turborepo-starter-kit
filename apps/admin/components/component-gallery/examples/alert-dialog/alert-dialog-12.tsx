"use client";

import * as React from "react";
import { BellIcon } from "lucide-react";
import { useCallback, useState } from "react";
import { Badge } from "@workspace/ui/components/badge";

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

export function AlertDialog12Example(): React.JSX.Element {
	// The base AlertDialogAction does not close the dialog on its own.
	const [open, setOpen] = useState(false);
	const closeDialog = useCallback((): void => {
		setOpen(false);
	}, []);

	return (
		<AlertDialog open={open} onOpenChange={setOpen}>
			<AlertDialogTrigger render={<Button variant="outline">Subscription Expiring</Button>} />
			<AlertDialogContent className="gap-0 p-0 sm:max-w-sm">
				<div className="mx-auto flex flex-col items-center justify-center gap-2 p-8">
					<AlertDialogMedia className="size-12 rounded-full bg-destructive/10 text-destructive dark:bg-destructive/20">
						<BellIcon className="size-6" />
					</AlertDialogMedia>
					<AlertDialogTitle className="text-center">Subscription Expiring Soon</AlertDialogTitle>
					<Badge variant="destructive-light" className="font-normal">
						Expires in 2 days
					</Badge>
				</div>

				<div className="flex flex-col items-center justify-center gap-5 rounded-b-2xl bg-muted/60 p-6">
					<AlertDialogDescription className="text-center text-muted-foreground">
						Your current plan will expire in 2 days. Update your payment method now to ensure uninterrupted access to your Pro features.
					</AlertDialogDescription>
					{/* The footer sits inside this `p-6` section, not directly in the
              content, so its breakout has to cancel THAT padding (`-mx-6
              -mb-6`) to reach the edges. `self-stretch` is required because the
              section is `items-center`, which would otherwise shrink the bar to
              its content width and leave the top border floating short. */}
					<AlertDialogFooter className="-mx-6 -mb-6 gap-4 self-stretch rounded-b-2xl p-6">
						<AlertDialogCancel>Remind Me Later</AlertDialogCancel>
						<AlertDialogAction onClick={closeDialog}>Update Payment</AlertDialogAction>
					</AlertDialogFooter>
				</div>
			</AlertDialogContent>
		</AlertDialog>
	);
}

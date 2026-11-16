"use client";

import * as React from "react";
import { CardSimIcon } from "lucide-react";
import { useCallback, useState } from "react";
import { Frame, FramePanel } from "@workspace/ui/components/frame";

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

export function AlertDialog9Example(): React.JSX.Element {
	// The base AlertDialogAction does not close the dialog on its own.
	const [open, setOpen] = useState(false);
	const closeDialog = useCallback((): void => {
		setOpen(false);
	}, []);

	return (
		<AlertDialog open={open} onOpenChange={setOpen}>
			<AlertDialogTrigger render={<Button variant="outline">Discard Changes</Button>} />
			<AlertDialogContent className="overflow-hidden p-0! ring-0">
				<Frame className="p-px">
					<FramePanel>
						<div className="flex items-start gap-3">
							<div className="flex size-10 shrink-0 items-center justify-center rounded-full border border-tone-yellow-soft bg-tone-yellow-soft text-tone-yellow">
								<CardSimIcon className="size-5" />
							</div>
							<div className="flex flex-col justify-center gap-1">
								<AlertDialogTitle className="text-sm font-semibold">Unsaved changes</AlertDialogTitle>
								<AlertDialogDescription className="text-sm text-muted-foreground">
									You have unsaved changes in this form. If you leave now, your progress will be lost.
								</AlertDialogDescription>
							</div>
						</div>
						<AlertDialogFooter className="mt-6 items-center gap-4 sm:justify-between">
							<div className="flex items-center gap-2">
								<Checkbox id="dont-ask-again" />
								<Label htmlFor="dont-ask-again" className="font-normal text-muted-foreground">
									Don&apos;t ask again
								</Label>
							</div>
							<div className="flex items-center gap-2">
								<AlertDialogCancel>Stay</AlertDialogCancel>
								<AlertDialogAction onClick={closeDialog}>Discard Changes</AlertDialogAction>
							</div>
						</AlertDialogFooter>
					</FramePanel>
				</Frame>
			</AlertDialogContent>
		</AlertDialog>
	);
}

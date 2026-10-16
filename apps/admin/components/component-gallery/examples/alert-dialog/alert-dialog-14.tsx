"use client";

import * as React from "react";
import { FingerprintPatternIcon, KeySquareIcon, LockIcon, ShieldAlertIcon } from "lucide-react";
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

const SECURITY_ITEMS = [
	{
		icon: <LockIcon className="size-4 text-muted-foreground" />,
		title: "Password Policy",
		description: "Verify strength and rotation",
		status: "Pending",
	},
	{
		icon: <FingerprintPatternIcon className="size-4 text-muted-foreground" />,
		title: "Biometric Status",
		description: "Check hardware encryption",
		status: "Done",
	},
	{
		icon: <KeySquareIcon className="size-4 text-muted-foreground" />,
		title: "Active Sessions",
		description: "Review connected devices",
		status: "Pending",
	},
];

export function AlertDialog14Example(): React.JSX.Element {
	// The base AlertDialogAction does not close the dialog on its own.
	const [open, setOpen] = useState(false);
	const closeDialog = useCallback((): void => {
		setOpen(false);
	}, []);

	return (
		<AlertDialog open={open} onOpenChange={setOpen}>
			<AlertDialogTrigger render={<Button variant="outline">Advanced Security Check</Button>} />
			<AlertDialogContent className="max-w-sm! gap-0 overflow-hidden p-0">
				{/* Header */}
				<div className="flex flex-col items-center justify-center gap-1.5 px-4 pt-6 pb-5 text-center">
					<AlertDialogMedia className="size-12 rounded-full bg-tone-green-soft text-tone-green">
						<ShieldAlertIcon className="size-6" />
					</AlertDialogMedia>
					<AlertDialogTitle className="text-base font-semibold">Advanced Security Audit</AlertDialogTitle>
					<AlertDialogDescription className="p-0 text-sm">Summary of your account status and security settings.</AlertDialogDescription>
				</div>

				{/* Content */}
				<div className="space-y-3 p-4">
					{SECURITY_ITEMS.map((item) => (
						<div key={item.title} className="flex items-center justify-between rounded-md border border-dashed border-border px-3 py-2.5">
							<div className="flex items-center gap-2.5">
								<div className="flex size-8 items-center justify-center rounded-md border border-border/80 bg-background shadow-xs">{item.icon}</div>
								<div className="flex flex-col gap-0.25">
									<span className="text-sm font-medium">{item.title}</span>
									<span className="text-xs text-muted-foreground">{item.description}</span>
								</div>
							</div>
							<Badge variant={item.status === "Pending" ? "warning-light" : "success-light"}>{item.status}</Badge>
						</div>
					))}
				</div>

				{/* Footer */}
				{/* The content is `p-0`, so there is no padding to escape: the footer's
            built-in `-mx-4 -mb-4` pushed the bar OUTSIDE the dialog, where
            `overflow-hidden` clipped it - which is why it looked like it had no
            padding. Cancelling the breakout puts it flush edge-to-edge with its
            own `p-4` intact. */}
				<AlertDialogFooter className="mx-0 mb-0 grid grid-cols-1 gap-2 p-4">
					<AlertDialogAction variant="default" className="flex-1" onClick={closeDialog}>
						Start Deep Audit
					</AlertDialogAction>
					<AlertDialogCancel variant="ghost" className="flex-1">
						Skip for now
					</AlertDialogCancel>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}

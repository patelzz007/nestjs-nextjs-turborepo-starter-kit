import * as React from "react";
import { CheckIcon } from "lucide-react";
import {
	AlertDialog,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogMedia,
	AlertDialogTitle,
	AlertDialogTrigger,
} from "@workspace/ui/components/alert-dialog";
import { Button } from "@workspace/ui/components/button";

export function AlertDialog10Example(): React.JSX.Element {
	return (
		<AlertDialog>
			<AlertDialogTrigger render={<Button variant="outline">View Confirmation</Button>} />
			<AlertDialogContent className="gap-8 p-8 sm:max-w-sm">
				<div className="mx-auto flex flex-col items-center justify-center gap-2">
					<AlertDialogMedia className="size-16 rounded-full bg-info/10 text-info dark:bg-info/20">
						<CheckIcon className="size-5" />
					</AlertDialogMedia>
					<AlertDialogTitle className="text-center">Success! Your e-ticket is registered.</AlertDialogTitle>
					<AlertDialogDescription className="max-w-xs text-center">Please check your email for confirmation and further instructions about the event.</AlertDialogDescription>
				</div>

				<div className="grid gap-4 rounded-xl bg-muted/60 p-4">
					{[
						["Order Number", "GBD99763JS"],
						["Order Date", "7 September 2024"],
						["Event Name", "Groove Beats Day Fest"],
						["Event Date", "20/09/2024"],
						["Register Date", "20/09/2024 | 09 PM"],
					].map(([label, value]) => (
						<div key={label} className="flex items-center justify-between text-sm">
							<span className="font-medium text-muted-foreground">{label}</span>
							<span className="font-semibold text-foreground">{value}</span>
						</div>
					))}
				</div>

				{/* The footer's built-in `-mx-4 -mb-4` cancels the content's DEFAULT
            `p-4`. This dialog uses `p-8`, so the breakout has to match it -
            otherwise the bar (and its top border) stops 1rem short on each
            side. `px-8` keeps the button aligned with the body above. */}
				<AlertDialogFooter className="-mx-8 -mb-8 px-8">
					<AlertDialogCancel size="lg" variant="default" className="w-full sm:w-full">
						Back to Home
					</AlertDialogCancel>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}

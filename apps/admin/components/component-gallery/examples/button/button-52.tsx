import * as React from "react";
import { CreditCardIcon } from "lucide-react";
import { Button } from "@workspace/ui/components/button";

export function Button52Example(): React.JSX.Element {
	return (
		<Button variant="outline" className="group/button h-auto justify-start gap-3 px-4 py-3 text-left">
			<div className="flex size-10 items-center justify-center rounded-md bg-muted text-accent-foreground group-hover/button:bg-background">
				<CreditCardIcon aria-hidden="true" className="size-5" />
			</div>
			<div className="flex flex-col gap-0.5">
				<span>Credit Card</span>
				<span className="text-xs font-normal text-muted-foreground">Pay securely with your Visa or Mastercard</span>
			</div>
		</Button>
	);
}

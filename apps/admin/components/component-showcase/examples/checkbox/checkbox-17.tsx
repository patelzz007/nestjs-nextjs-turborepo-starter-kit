"use client";

import * as React from "react";
import { CreditCardIcon } from "lucide-react";

import { Checkbox } from "@workspace/ui/components/checkbox";
import { Field, FieldLabel, FieldTitle } from "@workspace/ui/components/field";

export function Checkbox17Example(): React.JSX.Element {
	return (
		<div className="mx-auto w-full max-w-xs">
			<FieldLabel htmlFor="mastercard" className="relative p-0!">
				<Field orientation="horizontal">
					<Checkbox id="mastercard" defaultChecked className="absolute top-3 right-3 size-5 rounded-full" />
					<FieldTitle className="flex flex-col items-start gap-4!">
						<div className="flex size-10 items-center justify-center rounded-lg border border-border bg-background p-1.5 shadow-xs">
							<CreditCardIcon aria-hidden="true" className="size-full text-muted-foreground" />
						</div>
						<div className="flex flex-col items-start gap-0.5">
							<span className="text-sm font-medium">Mastercard ending in 8888</span>
							<span className="text-xs text-muted-foreground">Expires 09/25</span>
						</div>
					</FieldTitle>
				</Field>
			</FieldLabel>
		</div>
	);
}

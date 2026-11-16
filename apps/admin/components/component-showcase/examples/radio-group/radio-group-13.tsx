import * as React from "react";
import { CreditCardIcon, PlusIcon } from "lucide-react";

import { Field, FieldLabel, FieldTitle } from "@workspace/ui/components/field";
import { RadioGroup, RadioGroupItem } from "@workspace/ui/components/radio-group";

export function RadioGroup13Example(): React.JSX.Element {
	return (
		<div className="mx-auto w-full max-w-xs">
			<RadioGroup defaultValue="visa" className="flex flex-col gap-3">
				<FieldLabel htmlFor="pay-visa" className="relative p-0!">
					<Field orientation="horizontal">
						<div className="absolute top-3 right-3">
							<RadioGroupItem value="visa" id="pay-visa" />
						</div>
						<FieldTitle className="flex flex-col items-start gap-4!">
							<div className="flex size-10 items-center justify-center rounded-lg border border-border bg-background p-1.5 shadow-xs">
								<CreditCardIcon aria-hidden="true" className="size-full text-muted-foreground" />
							</div>
							<div className="flex flex-col items-start gap-0.5">
								<span className="text-sm font-medium">Visa ending in 4242</span>
								<span className="text-xs text-muted-foreground">Expires 12/26</span>
							</div>
						</FieldTitle>
					</Field>
				</FieldLabel>
				<FieldLabel htmlFor="pay-mc" className="relative p-0!">
					<Field orientation="horizontal">
						<div className="absolute top-3 right-3">
							<RadioGroupItem value="mastercard" id="pay-mc" />
						</div>
						<FieldTitle className="flex flex-col items-start gap-4!">
							<div className="flex size-10 items-center justify-center rounded-2xl border border-border bg-background p-1.5 shadow-xs">
								<CreditCardIcon aria-hidden="true" className="size-full text-muted-foreground" />
							</div>
							<div className="flex flex-col items-start gap-0.5">
								<span className="text-sm font-medium">Mastercard ending in 8888</span>
								<span className="text-xs text-muted-foreground">Expires 09/25</span>
							</div>
						</FieldTitle>
					</Field>
				</FieldLabel>
				<FieldLabel htmlFor="pay-new" className="relative p-0!">
					<Field orientation="horizontal" className="justify-center">
						<RadioGroupItem value="new" id="pay-new" className="absolute top-3 right-3" />
						<FieldTitle className="flex items-center gap-2">
							<PlusIcon aria-hidden="true" className="size-4 opacity-60" />
							Add new payment method
						</FieldTitle>
					</Field>
				</FieldLabel>
			</RadioGroup>
		</div>
	);
}

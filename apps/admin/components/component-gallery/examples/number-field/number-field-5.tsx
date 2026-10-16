import * as React from "react";
import { ChevronDownIcon, ChevronUpIcon } from "lucide-react";
import { NumberField, NumberFieldDecrement, NumberFieldGroup, NumberFieldIncrement, NumberFieldInput, NumberFieldScrubArea } from "@workspace/ui/components/number-field";

export function NumberField5Example(): React.JSX.Element {
	return (
		<div className="w-full max-w-48">
			<NumberField defaultValue={5} min={0} max={100}>
				<NumberFieldScrubArea label="Amount" />
				<NumberFieldGroup>
					<NumberFieldInput className="text-start" />

					<div className="m-px flex shrink-0 flex-col overflow-hidden rounded-lg border border-input bg-muted/30">
						<NumberFieldIncrement className="flex h-3.5 w-full flex-1 shrink-0 items-center rounded-none! border-b border-input px-1.5 leading-none hover:bg-accent focus-visible:bg-accent">
							<ChevronUpIcon className="size-3.5" />
						</NumberFieldIncrement>
						<NumberFieldDecrement className="flex h-3.5 w-full flex-1 shrink-0 items-center rounded-none! px-1.5 leading-none hover:bg-accent focus-visible:bg-accent">
							<ChevronDownIcon className="size-3.5" />
						</NumberFieldDecrement>
					</div>
				</NumberFieldGroup>
			</NumberField>
		</div>
	);
}

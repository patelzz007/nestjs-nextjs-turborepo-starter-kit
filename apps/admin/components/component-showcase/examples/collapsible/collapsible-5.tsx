"use client";

import * as React from "react";
import { Settings2Icon } from "lucide-react";
import { useState } from "react";

import { Button } from "@workspace/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@workspace/ui/components/collapsible";
import { Field, FieldGroup, FieldLabel } from "@workspace/ui/components/field";
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from "@workspace/ui/components/input-group";

export function Collapsible5Example(): React.JSX.Element {
	const [isOpen, setIsOpen] = useState(false);

	return (
		<div className="h-54 w-full max-w-xs">
			<Card size="sm">
				<CardHeader>
					<CardTitle>Unit Pricing</CardTitle>
				</CardHeader>
				<CardContent>
					<Collapsible open={isOpen} onOpenChange={setIsOpen} className="flex flex-col">
						<div className="flex items-end gap-2">
							<Field className="flex-1">
								<FieldLabel className="sr-only">Base Price</FieldLabel>
								<InputGroup>
									<InputGroupInput type="number" placeholder="0.00" defaultValue="19.00" />
									<InputGroupAddon align="inline-end">
										<InputGroupText>$</InputGroupText>
									</InputGroupAddon>
								</InputGroup>
							</Field>
							<CollapsibleTrigger render={<Button variant="outline" size="icon" className="shrink-0" />}>
								<Settings2Icon aria-hidden="true" className="size-3.5" />
							</CollapsibleTrigger>
						</div>

						<CollapsibleContent className="-mx-1 -mb-1 h-(--collapsible-panel-height) overflow-hidden px-1 pb-1 transition-[height] duration-200 ease-out data-ending-style:h-0 data-starting-style:h-0 motion-reduce:transition-none">
							<FieldGroup className="gap-2 pt-3">
								<Field>
									<FieldLabel>Tax Rate (%)</FieldLabel>
									<InputGroup>
										<InputGroupInput type="number" placeholder="0" defaultValue="15" />
										<InputGroupAddon align="inline-end">
											<InputGroupText>%</InputGroupText>
										</InputGroupAddon>
									</InputGroup>
								</Field>
								<Field>
									<FieldLabel>Discount (%)</FieldLabel>
									<InputGroup>
										<InputGroupInput type="number" placeholder="0" defaultValue="0" />
										<InputGroupAddon align="inline-end">
											<InputGroupText>%</InputGroupText>
										</InputGroupAddon>
									</InputGroup>
								</Field>
							</FieldGroup>
						</CollapsibleContent>
					</Collapsible>
				</CardContent>
			</Card>
		</div>
	);
}

import * as React from "react";
import { ChevronRightIcon } from "lucide-react";
import { Button } from "@workspace/ui/components/button";
import { Card } from "@workspace/ui/components/card";
import { Checkbox } from "@workspace/ui/components/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@workspace/ui/components/collapsible";
import { Field, FieldGroup, FieldLabel, FieldTitle } from "@workspace/ui/components/field";

const settings = [
	{ id: "push", label: "Push notifications", defaultChecked: true },
	{ id: "email", label: "Email notifications", defaultChecked: false },
	{ id: "sms", label: "SMS notifications", defaultChecked: false },
];

export function Collapsible2Example(): React.JSX.Element {
	return (
		<div className="h-40 w-full max-w-xs">
			<Collapsible className="flex flex-col gap-2" defaultOpen>
				<CollapsibleTrigger render={<Button variant="outline" className="w-full justify-start bg-background!" />}>
					<ChevronRightIcon aria-hidden="true" className="size-4 group-aria-expanded/button:rotate-90" />
					<span className="sr-only">Toggle notification settings</span>
					Notification settings
				</CollapsibleTrigger>

				<CollapsibleContent>
					<Card className="p-0">
						<FieldGroup className="gap-0 divide-y">
							{settings.map((item) => (
								<Field key={item.id}>
									<FieldLabel className="px-3 py-2">
										<Checkbox defaultChecked={item.defaultChecked} />
										<FieldTitle>{item.label}</FieldTitle>
									</FieldLabel>
								</Field>
							))}
						</FieldGroup>
					</Card>
				</CollapsibleContent>
			</Collapsible>
		</div>
	);
}

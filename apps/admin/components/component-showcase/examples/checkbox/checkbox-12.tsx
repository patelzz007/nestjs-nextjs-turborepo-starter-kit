import * as React from "react";
import { LaptopIcon, MailIcon, SmartphoneIcon } from "lucide-react";
import { Card } from "@workspace/ui/components/card";
import { Checkbox } from "@workspace/ui/components/checkbox";
import { Field, FieldGroup, FieldLabel, FieldTitle } from "@workspace/ui/components/field";
import { Separator } from "@workspace/ui/components/separator";

export function Checkbox12Example(): React.JSX.Element {
	return (
		<Card className="w-full max-w-xs p-0">
			<FieldGroup className="gap-0">
				<Field>
					<FieldLabel className="justify-between px-4 py-3">
						<FieldTitle className="flex items-center gap-2">
							<LaptopIcon aria-hidden="true" className="size-4 opacity-60" />
							Push notifications
						</FieldTitle>
						<Checkbox defaultChecked />
					</FieldLabel>
				</Field>
				<Separator />
				<Field>
					<FieldLabel className="justify-between px-4 py-3">
						<FieldTitle className="flex items-center gap-2">
							<MailIcon aria-hidden="true" className="size-4 opacity-60" />
							Email notifications
						</FieldTitle>
						<Checkbox />
					</FieldLabel>
				</Field>
				<Separator />
				<Field>
					<FieldLabel className="justify-between px-4 py-3">
						<FieldTitle className="flex items-center gap-2">
							<SmartphoneIcon aria-hidden="true" className="size-4 opacity-60" />
							SMS notifications
						</FieldTitle>
						<Checkbox />
					</FieldLabel>
				</Field>
			</FieldGroup>
		</Card>
	);
}

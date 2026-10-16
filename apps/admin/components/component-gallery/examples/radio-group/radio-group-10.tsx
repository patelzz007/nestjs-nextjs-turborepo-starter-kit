import * as React from "react";
import { Frame, FrameHeader, FramePanel, FrameTitle } from "@workspace/ui/components/frame";

import { Field, FieldGroup, FieldLabel, FieldTitle } from "@workspace/ui/components/field";
import { RadioGroup, RadioGroupItem } from "@workspace/ui/components/radio-group";
import { Separator } from "@workspace/ui/components/separator";

export function RadioGroup10Example(): React.JSX.Element {
	return (
		<Frame className="w-full max-w-xs" spacing="sm">
			<FrameHeader>
				<FrameTitle>Language</FrameTitle>
			</FrameHeader>
			<FramePanel className="overflow-hidden p-0!">
				<RadioGroup defaultValue="en">
					<FieldGroup className="gap-0">
						<Field>
							<FieldLabel className="p-3">
								<RadioGroupItem value="en" id="lang-en" />
								<FieldTitle>English</FieldTitle>
							</FieldLabel>
						</Field>
						<Separator />
						<Field>
							<FieldLabel className="p-3">
								<RadioGroupItem value="es" id="lang-es" />
								<FieldTitle>Spanish</FieldTitle>
							</FieldLabel>
						</Field>
						<Separator />
						<Field>
							<FieldLabel className="p-3">
								<RadioGroupItem value="fr" id="lang-fr" />
								<FieldTitle>French</FieldTitle>
							</FieldLabel>
						</Field>
						<Separator />
						<Field>
							<FieldLabel className="p-3">
								<RadioGroupItem value="de" id="lang-de" />
								<FieldTitle>German</FieldTitle>
							</FieldLabel>
						</Field>
					</FieldGroup>
				</RadioGroup>
			</FramePanel>
		</Frame>
	);
}

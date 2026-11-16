import * as React from "react";
import { Frame, FrameHeader, FramePanel, FrameTitle } from "@workspace/ui/components/frame";

import { Checkbox } from "@workspace/ui/components/checkbox";
import { Field, FieldGroup, FieldLabel, FieldTitle } from "@workspace/ui/components/field";
import { Separator } from "@workspace/ui/components/separator";

export function Checkbox10Example(): React.JSX.Element {
	return (
		<Frame className="w-full max-w-xs" spacing="sm">
			<FrameHeader>
				<FrameTitle>Notification Settings</FrameTitle>
			</FrameHeader>
			<FramePanel className="overflow-hidden p-0!">
				<FieldGroup className="gap-0">
					<Field>
						<FieldLabel className="p-3">
							<Checkbox defaultChecked />
							<FieldTitle>Push notifications</FieldTitle>
						</FieldLabel>
					</Field>
					<Separator />
					<Field>
						<FieldLabel className="p-3">
							<Checkbox />
							<FieldTitle>Email notifications</FieldTitle>
						</FieldLabel>
					</Field>
					<Separator />
					<Field>
						<FieldLabel className="p-3">
							<Checkbox />
							<FieldTitle>SMS notifications</FieldTitle>
						</FieldLabel>
					</Field>
				</FieldGroup>
			</FramePanel>
		</Frame>
	);
}

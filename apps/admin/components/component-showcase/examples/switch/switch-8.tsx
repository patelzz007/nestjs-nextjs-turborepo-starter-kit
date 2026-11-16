import * as React from "react";
import { Frame, FrameHeader, FramePanel, FrameTitle } from "@workspace/ui/components/frame";

import { Field, FieldGroup, FieldLabel, FieldTitle } from "@workspace/ui/components/field";
import { Separator } from "@workspace/ui/components/separator";
import { Switch } from "@workspace/ui/components/switch";

export function Switch8Example(): React.JSX.Element {
	return (
		<Frame className="w-full max-w-xs" spacing="sm">
			<FrameHeader>
				<FrameTitle>Privacy Settings</FrameTitle>
			</FrameHeader>
			<FramePanel className="overflow-hidden p-0!">
				<FieldGroup className="gap-0">
					<Field>
						<FieldLabel className="justify-between p-3">
							<FieldTitle>Profile visibility</FieldTitle>
							<Switch defaultChecked />
						</FieldLabel>
					</Field>
					<Separator />
					<Field>
						<FieldLabel className="justify-between p-3">
							<FieldTitle>Show online status</FieldTitle>
							<Switch defaultChecked />
						</FieldLabel>
					</Field>
					<Separator />
					<Field>
						<FieldLabel className="justify-between p-3">
							<FieldTitle>Allow data collection</FieldTitle>
							<Switch />
						</FieldLabel>
					</Field>
				</FieldGroup>
			</FramePanel>
		</Frame>
	);
}

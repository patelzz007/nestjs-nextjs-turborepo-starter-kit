import * as React from "react";
import { BellIcon, MailIcon, MessageSquareIcon, PhoneIcon } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@workspace/ui/components/toggle-group";

export function ToggleGroup13Example(): React.JSX.Element {
	return (
		<div className="flex items-center justify-center">
			<ToggleGroup multiple defaultValue={["email", "push"]} variant="outline" spacing={1}>
				<ToggleGroupItem value="email" aria-label="Email notifications">
					<MailIcon />
					Email
				</ToggleGroupItem>
				<ToggleGroupItem value="sms" aria-label="SMS notifications">
					<PhoneIcon />
					SMS
				</ToggleGroupItem>
				<ToggleGroupItem value="push" aria-label="Push notifications">
					<BellIcon />
					Push
				</ToggleGroupItem>
				<ToggleGroupItem value="slack" aria-label="Slack notifications">
					<MessageSquareIcon />
					Slack
				</ToggleGroupItem>
			</ToggleGroup>
		</div>
	);
}

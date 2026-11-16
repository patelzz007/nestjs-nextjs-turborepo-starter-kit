import BellIcon from "lucide-react-native/icons/bell";
import { Checkbox } from "@workspace/ui-native/components/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@workspace/ui-native/components/collapsible";
import * as React from "react";

export function Collapsible2Example(): React.JSX.Element {
	const [open, setOpen] = React.useState(true);
	const [email, setEmail] = React.useState(true);
	const [push, setPush] = React.useState(false);
	const [sms, setSms] = React.useState(false);
	return (
		<Collapsible open={open} onOpenChange={setOpen} variant="card">
			<CollapsibleTrigger label="Notification channels" icon={BellIcon} />
			<CollapsibleContent className="gap-3">
				<Checkbox label="Email" checked={email} onChange={setEmail} />
				<Checkbox label="Push" checked={push} onChange={setPush} />
				<Checkbox label="Text message" checked={sms} onChange={setSms} />
			</CollapsibleContent>
		</Collapsible>
	);
}

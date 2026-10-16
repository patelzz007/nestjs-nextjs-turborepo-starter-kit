import * as React from "react";
import { HelpCircleIcon, LockIcon, SettingsIcon } from "lucide-react";
import { Badge } from "@workspace/ui/components/badge";

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@workspace/ui/components/accordion";

const items = [
	{
		value: "account",
		icon: <SettingsIcon className="size-4 text-muted-foreground" />,
		trigger: "Account Settings",
		badge: "New",
		content: "Manage your account preferences, security settings, and personal information. You can also configure two-factor authentication here.",
	},
	{
		value: "privacy",
		icon: <LockIcon className="size-4 text-muted-foreground" />,
		trigger: "Privacy & Security",
		content: "Control who can see your profile and what data we collect. View our latest security audits and transparency reports.",
	},
	{
		value: "support",
		icon: <HelpCircleIcon className="size-4 text-muted-foreground" />,
		trigger: "Help & Support",
		content: "Access our help center, community forums, and contact support. We're here to help you 24/7.",
	},
];

export function Accordion6Example(): React.JSX.Element {
	return (
		<div className="mx-auto mb-auto w-full max-w-lg">
			<Accordion multiple={false} defaultValue={["account"]} className="space-y-3 border-0">
				{items.map((item) => (
					<AccordionItem key={item.value} value={item.value} className="rounded-lg border border-border bg-card px-2 **:data-[slot=accordion-content]:p-0!">
						<AccordionTrigger className="items-center px-1 py-3 font-semibold hover:no-underline">
							<div className="flex items-center gap-3">
								<div className="flex size-8 items-center justify-center rounded-lg bg-muted">{item.icon}</div>
								<span>{item.trigger}</span>
								{item.badge ? <Badge variant="success-light">{item.badge}</Badge> : null}
							</div>
						</AccordionTrigger>
						<AccordionContent className="px-2 pt-0 pb-4 leading-relaxed text-muted-foreground">
							<div className="pl-11">{item.content}</div>
						</AccordionContent>
					</AccordionItem>
				))}
			</Accordion>
		</div>
	);
}

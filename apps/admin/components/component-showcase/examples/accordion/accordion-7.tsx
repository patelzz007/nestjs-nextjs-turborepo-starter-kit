import * as React from "react";
import { HelpCircleIcon, LockIcon, SettingsIcon } from "lucide-react";
import { Badge } from "@workspace/ui/components/badge";
import { Frame, FramePanel } from "@workspace/ui/components/frame";

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

const [firstItem] = items;
/** The first panel starts open. */
const DEFAULT_OPEN: string[] = firstItem === undefined ? [] : [firstItem.value];

export function Accordion7Example(): React.JSX.Element {
	return (
		<div className="mx-auto mb-auto w-full max-w-lg">
			<Frame stacked spacing="sm">
				{items.map((item) => (
					<FramePanel key={item.value}>
						<Accordion multiple={false} defaultValue={DEFAULT_OPEN} className="border-none">
							<AccordionItem value={item.value} className="border-none bg-transparent **:data-[slot=accordion-content]:p-0!">
								<AccordionTrigger className="items-center px-1 py-1 font-semibold hover:no-underline">
									<div className="flex items-center gap-3">
										<div className="flex size-8 items-center justify-center rounded-lg bg-muted">{item.icon}</div>
										<span>{item.trigger}</span>
										{item.badge ? (
											<Badge variant="success-light" className="ms-1">
												{item.badge}
											</Badge>
										) : null}
									</div>
								</AccordionTrigger>
								<AccordionContent className="p-0 ps-1! text-muted-foreground">
									<div className="ps-11! pe-2">{item.content}</div>
								</AccordionContent>
							</AccordionItem>
						</Accordion>
					</FramePanel>
				))}
			</Frame>
		</div>
	);
}

import CircleCheckIcon from "lucide-react-native/icons/circle-check";
import CircleDashedIcon from "lucide-react-native/icons/circle-dashed";
import LoaderIcon from "lucide-react-native/icons/loader";
import { Badge } from "@workspace/ui-native/components/badge";
import { Button } from "@workspace/ui-native/components/button";
import { IconTile } from "@workspace/ui-native/components/icon-tile";
import { QrCode } from "@workspace/ui-native/components/qr-code";
import { TextField } from "@workspace/ui-native/components/text-field";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@workspace/ui-native/components/accordion";
import * as React from "react";
import { Text, View } from "react-native";

import { ignorePress } from "../example-support";

const INITIAL: readonly string[] = ["invite"];
const SCAN_HINT = "Scan with your phone's camera.";

export function Accordion11Example(): React.JSX.Element {
	const [open, setOpen] = React.useState<readonly string[]>(INITIAL);
	const [email, setEmail] = React.useState("");
	return (
		<Accordion value={open} onChange={setOpen} variant="separated">
			<AccordionItem value="account">
				<AccordionTrigger
					label="Create your account"
					leading={<IconTile icon={CircleCheckIcon} tone="green" size="sm" />}
					trailing={<Badge label="Done" tone="success" size="sm" />}
				/>
				<AccordionContent>
					<Text className="text-body font-sans text-muted-foreground">Signed in as ava@acme.com.</Text>
				</AccordionContent>
			</AccordionItem>
			<AccordionItem value="invite">
				<AccordionTrigger
					label="Invite your team"
					leading={<IconTile icon={LoaderIcon} tone="blue" size="sm" />}
					trailing={<Badge label="In progress" tone="info" size="sm" />}
				/>
				<AccordionContent className="gap-3">
					<TextField label="Teammate's email" value={email} onChange={setEmail} keyboardType="email-address" autoCapitalize="none" />
					<Button label="Send invite" size="sm" onPress={ignorePress} className="self-start" />
				</AccordionContent>
			</AccordionItem>
			<AccordionItem value="app">
				<AccordionTrigger label="Get the app" leading={<IconTile icon={CircleDashedIcon} tone="neutral" size="sm" />} trailing={<Badge label="Pending" size="sm" />} />
				<AccordionContent>
					<View className="items-center gap-2">
						<QrCode value="https://acme.com/app" label="Scan to get the app" size="sm" />
						<Text className="text-body font-sans text-muted-foreground">{SCAN_HINT}</Text>
					</View>
				</AccordionContent>
			</AccordionItem>
		</Accordion>
	);
}

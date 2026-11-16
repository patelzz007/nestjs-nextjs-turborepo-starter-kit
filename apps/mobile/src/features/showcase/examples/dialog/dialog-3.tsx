import { Button } from "@workspace/ui-native/components/button";
import { Dialog, DialogBody, DialogFooter, DialogHeader, DialogTitle } from "@workspace/ui-native/components/dialog";
import { Text } from "react-native";
import * as React from "react";

/** Read-only terms, long enough to scroll. */
const TERMS: readonly string[] = Array.from(
	{ length: 12 },
	(_paragraph: undefined, index: number): string =>
		`${String(index + 1)}. You agree to use the service in line with these terms. We may update them from time to time, and we will tell you when we do. Keep your sign-in details safe and let us know at once if they are misused.`,
);
const TITLE = "Terms of service";

export function Dialog3Example(): React.JSX.Element {
	const [open, setOpen] = React.useState(false);
	const show = React.useCallback((): void => {
		setOpen(true);
	}, []);
	const hide = React.useCallback((): void => {
		setOpen(false);
	}, []);
	return (
		<>
			<Button label="Read the terms" variant="outline" onPress={show} />
			<Dialog open={open} onOpenChange={setOpen}>
				<DialogHeader>
					<DialogTitle>{TITLE}</DialogTitle>
				</DialogHeader>
				<DialogBody>
					{TERMS.map((paragraph: string): React.JSX.Element => (
						<Text key={paragraph} className="text-body font-sans text-muted-foreground">
							{paragraph}
						</Text>
					))}
				</DialogBody>
				<DialogFooter>
					<Button label="Close" variant="outline" onPress={hide} />
				</DialogFooter>
			</Dialog>
		</>
	);
}

import { Button } from "@workspace/ui-native/components/button";
import { Dialog, DialogBody, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@workspace/ui-native/components/dialog";
import { Text } from "react-native";
import * as React from "react";

/** Read-only terms, long enough to scroll. */
const TERMS: readonly string[] = Array.from(
	{ length: 12 },
	(_paragraph: undefined, index: number): string =>
		`${String(index + 1)}. You agree to use the service in line with these terms. We may update them from time to time, and we will tell you when we do. Keep your sign-in details safe and let us know at once if they are misused.`,
);
const TITLE = "Release notes";
const DESCRIPTION = "Everything new in version 2.4.";

export function Dialog6Example(): React.JSX.Element {
	const [open, setOpen] = React.useState(false);
	const show = React.useCallback((): void => {
		setOpen(true);
	}, []);
	const hide = React.useCallback((): void => {
		setOpen(false);
	}, []);
	return (
		<>
			<Button label="Open full screen" variant="outline" onPress={show} />
			<Dialog open={open} onOpenChange={setOpen} size="full" showCloseButton>
				<DialogHeader className="border-b border-border p-6">
					<DialogTitle>{TITLE}</DialogTitle>
					<DialogDescription>{DESCRIPTION}</DialogDescription>
				</DialogHeader>
				<DialogBody height="fill" className="px-6">
					{TERMS.map((paragraph: string): React.JSX.Element => (
						<Text key={paragraph} className="text-body font-sans text-muted-foreground">
							{paragraph}
						</Text>
					))}
				</DialogBody>
				<DialogFooter layout="row" className="border-t border-border p-4">
					<Button label="Cancel" variant="outline" onPress={hide} className="flex-1" />
					<Button label="Got it" onPress={hide} className="flex-1" />
				</DialogFooter>
			</Dialog>
		</>
	);
}

import { Button } from "@workspace/ui-native/components/button";
import { Drawer } from "@workspace/ui-native/components/sheet";
import { Text } from "react-native";
import * as React from "react";

/** Read-only terms, long enough to scroll. */
const TERMS: readonly string[] = Array.from(
	{ length: 12 },
	(_paragraph: undefined, index: number): string =>
		`${String(index + 1)}. You agree to use the service in line with these terms. We may update them from time to time, and we will tell you when we do. Keep your sign-in details safe and let us know at once if they are misused.`,
);

export function Drawer1Example(): React.JSX.Element {
	const [open, setOpen] = React.useState(false);
	const show = React.useCallback((): void => {
		setOpen(true);
	}, []);
	return (
		<>
			<Button label="Open drawer" variant="outline" onPress={show} />
			<Drawer open={open} onOpenChange={setOpen} title="Terms" description="Swipe down to close." size="lg">
				{TERMS.map((paragraph: string): React.JSX.Element => (
					<Text key={paragraph} className="text-body font-sans text-muted-foreground">
						{paragraph}
					</Text>
				))}
			</Drawer>
		</>
	);
}

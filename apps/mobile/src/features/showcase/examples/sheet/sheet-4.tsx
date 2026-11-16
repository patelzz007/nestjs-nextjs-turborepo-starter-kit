import { Button } from "@workspace/ui-native/components/button";
import { Sheet } from "@workspace/ui-native/components/sheet";
import { Text } from "react-native";
import * as React from "react";

/** Read-only terms, long enough to scroll. */
const TERMS: readonly string[] = Array.from(
	{ length: 12 },
	(_paragraph: undefined, index: number): string =>
		`${String(index + 1)}. You agree to use the service in line with these terms. We may update them from time to time, and we will tell you when we do. Keep your sign-in details safe and let us know at once if they are misused.`,
);

export function Sheet4Example(): React.JSX.Element {
	const [open, setOpen] = React.useState(false);
	const show = React.useCallback((): void => {
		setOpen(true);
	}, []);
	const hide = React.useCallback((): void => {
		setOpen(false);
	}, []);
	const footer = (
		<>
			<Button label="Save changes" onPress={hide} />
			<Button label="Cancel" variant="outline" onPress={hide} />
		</>
	);
	return (
		<>
			<Button label="Open long sheet" variant="outline" onPress={show} />
			<Sheet open={open} onOpenChange={setOpen} title="Terms of service" description="Read before you accept." footer={footer}>
				{TERMS.map((paragraph: string): React.JSX.Element => (
					<Text key={paragraph} className="text-body font-sans text-muted-foreground">
						{paragraph}
					</Text>
				))}
			</Sheet>
		</>
	);
}

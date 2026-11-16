import { Button } from "@workspace/ui-native/components/button";
import { AlertDialog } from "@workspace/ui-native/components/alert-dialog";
import { Checkbox } from "@workspace/ui-native/components/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui-native/components/card";
import { TextField } from "@workspace/ui-native/components/text-field";
import * as React from "react";

const TITLE = "Edit post";

export function AlertDialog9Example(): React.JSX.Element {
	const [text, setText] = React.useState("Draft: our spring roadmap");
	const [asking, setAsking] = React.useState(false);
	const [dontAsk, setDontAsk] = React.useState(false);
	const leave = React.useCallback((): void => {
		setAsking(true);
	}, []);
	const stay = React.useCallback((): void => {
		setAsking(false);
	}, []);
	const discard = React.useCallback((): void => {
		setText("");
		setAsking(false);
	}, []);
	return (
		<Card>
			<CardHeader>
				<CardTitle>{TITLE}</CardTitle>
			</CardHeader>
			<CardContent className="gap-3">
				<TextField label="Title" value={text} onChange={setText} />
				<Button label="Back to posts" variant="outline" onPress={leave} />
				<AlertDialog
					visible={asking}
					title="Discard unsaved changes?"
					description="You have edits that are not saved yet."
					confirmLabel="Discard"
					cancelLabel="Stay"
					onConfirm={discard}
					onCancel={stay}
					destructive>
					<Checkbox label="Don't ask again" checked={dontAsk} onChange={setDontAsk} />
				</AlertDialog>
			</CardContent>
		</Card>
	);
}

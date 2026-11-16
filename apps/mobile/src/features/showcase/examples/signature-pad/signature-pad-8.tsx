import { Button } from "@workspace/ui-native/components/button";
import { Dialog, DialogFooter, DialogHeader, DialogTitle } from "@workspace/ui-native/components/dialog";
import { SignaturePad, type SignatureStroke } from "@workspace/ui-native/components/signature-pad";
import * as React from "react";
import { View } from "react-native";

import { ignorePress } from "../example-support";

const TITLE = "Your signature";

export function SignaturePad8Example(): React.JSX.Element {
	const [stored, setStored] = React.useState<readonly SignatureStroke[]>([]);
	const [draft, setDraft] = React.useState<readonly SignatureStroke[]>([]);
	const [dialogOpen, setDialogOpen] = React.useState<boolean>(false);
	// Edits happen on a draft: Cancel keeps the stored signature.
	const open = React.useCallback((): void => {
		setDraft(stored);
		setDialogOpen(true);
	}, [stored]);
	const cancel = React.useCallback((): void => {
		setDialogOpen(false);
	}, []);
	const keep = React.useCallback((): void => {
		setStored(draft);
		setDialogOpen(false);
	}, [draft]);
	return (
		<View className="gap-3">
			{stored.length === 0 ? null : <SignaturePad strokes={stored} onChange={ignorePress} readOnly size="sm" />}
			<Button label={stored.length === 0 ? "Add signature" : "Change signature"} variant="outline" onPress={open} />
			<Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
				<DialogHeader>
					<DialogTitle>{TITLE}</DialogTitle>
				</DialogHeader>
				<SignaturePad strokes={draft} onChange={setDraft} />
				<DialogFooter>
					<Button label="Cancel" variant="outline" onPress={cancel} />
					<Button label="Save" onPress={keep} />
				</DialogFooter>
			</Dialog>
		</View>
	);
}

import { Button } from "@workspace/ui-native/components/button";
import * as React from "react";
import { Text, View } from "react-native";

import { PdfDocumentViewer } from "../../../pdf-viewer/pdf-document-viewer";
import { pickPdf, writeSamplePdf } from "../../../pdf-viewer/pdf-files";
import type { PdfSource } from "../../../pdf-viewer/pdf-source";

// A PDF with page steps, zoom and search (where this phone's engine can draw it), and a file picker to open another.
export function PdfViewer1Example(): React.JSX.Element {
	const [source, setSource] = React.useState<PdfSource | null>(null);
	const openSample = React.useCallback((): void => {
		setSource(writeSamplePdf());
	}, []);
	const pick = React.useCallback((): void => {
		pickPdf()
			.then((picked: PdfSource | null): void => {
				if (picked !== null) {
					setSource(picked);
				}
			})
			// A picker that fails to open leaves the viewer as it was.
			.catch((): void => undefined);
	}, []);
	const close = React.useCallback((): void => {
		setSource(null);
	}, []);
	if (source !== null) {
		return (
			<View className="h-[520px] w-full overflow-hidden rounded-xl border border-border">
				<PdfDocumentViewer source={source} onClose={close} />
			</View>
		);
	}
	return (
		<View className="w-full items-center gap-3 rounded-xl border border-dashed border-border p-6">
			<Text className="text-label text-center font-sans text-muted-foreground">Open the sample document, or pick a PDF from this phone.</Text>
			<View className="flex-row gap-2">
				<Button label="Open sample" size="sm" onPress={openSample} />
				<Button label="Pick a PDF" variant="outline" size="sm" onPress={pick} />
			</View>
		</View>
	);
}

import { getFileType, getFileTypeCategory } from "@workspace/ui-kit-logic";
import { Button } from "@workspace/ui-native/components/button";
import { Card, CardContent, CardFooter } from "@workspace/ui-native/components/card";
import { Field } from "@workspace/ui-native/components/field";
import { FileType, type FileTypeVariant } from "@workspace/ui-native/components/file-type";
import { InputGroup } from "@workspace/ui-native/components/input-group";
import * as React from "react";
import { Text, View } from "react-native";

const SAMPLES: readonly string[] = ["Q3 report.pdf", "photos/IMG_2041.HEIC", "video/quicktime", "assets/", ".env.local", "https://example.com/data.csv?v=2"];
const VARIANTS: readonly { readonly variant: FileTypeVariant; readonly label: string }[] = [
	{ variant: "outline", label: "Outline" },
	{ variant: "solid", label: "Solid" },
	{ variant: "light", label: "Light" },
	{ variant: "mono", label: "Mono" },
];

function hintOf(value: string, type: string): string | null {
	if (value.trim() === "") {
		return "Nothing to resolve yet, so it shows a blank page.";
	}
	if (type === "empty") {
		return "No extension or known MIME type, so it shows a blank page.";
	}
	if (getFileTypeCategory(type) === "file") {
		return "Unknown extension, so it shows a neutral page with its label.";
	}
	return null;
}

function SampleButton({ sample, onPick }: { readonly sample: string; readonly onPick: (sample: string) => void }): React.JSX.Element {
	const pick = React.useCallback((): void => {
		onPick(sample);
	}, [onPick, sample]);
	return <Button label={sample} variant="outline" size="xs" onPress={pick} />;
}

export function FileType9Example(): React.JSX.Element {
	const [value, setValue] = React.useState("Q3 report.pdf");
	const type = getFileType(value);
	const family = getFileTypeCategory(type);
	const hint = hintOf(value, type);
	const leading = <FileType type={type} size="mini" />;
	return (
		<View className="gap-6">
			<View className="gap-3">
				<Field label="File name, path, URL or MIME type">
					<InputGroup value={value} onChange={setValue} leading={leading} placeholder="invoice.docx or image/png" autoCapitalize="none" autoCorrect={false} />
				</Field>
				<View className="flex-row flex-wrap items-center gap-1.5">
					<Text className="text-caption me-1 font-sans text-muted-foreground">Try</Text>
					{SAMPLES.map((sample: string): React.JSX.Element => (
						<SampleButton key={sample} sample={sample} onPick={setValue} />
					))}
				</View>
			</View>
			<Card>
				<CardContent>
					<View className="flex-row justify-around gap-4">
						{VARIANTS.map((entry): React.JSX.Element => (
							<View key={entry.variant} className="items-center gap-2">
								<FileType type={type} variant={entry.variant} size="lg" />
								<Text className="text-caption font-sans text-muted-foreground">{entry.label}</Text>
							</View>
						))}
					</View>
				</CardContent>
				<CardFooter>
					{/* Text only in the live region, so each change is read once: "Type pdf, Family document". */}
					<View accessibilityLiveRegion="polite" className="flex-1 gap-1">
						<View className="flex-row flex-wrap gap-x-6 gap-y-1">
							<Text className="text-label font-sans text-muted-foreground">
								Type <Text className="font-code text-foreground">{type}</Text>
							</Text>
							<Text className="text-label font-sans text-muted-foreground">
								Family <Text className="font-code text-foreground">{family}</Text>
							</Text>
						</View>
						{hint === null ? null : <Text className="text-caption font-sans text-muted-foreground">{hint}</Text>}
					</View>
				</CardFooter>
			</Card>
		</View>
	);
}

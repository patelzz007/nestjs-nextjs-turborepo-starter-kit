import { CodeBlock } from "@workspace/ui-native/components/code-block";
import * as React from "react";
import { Attachment } from "@workspace/ui-native/components/attachment";
import FileCodeIcon from "lucide-react-native/icons/file-code";
import { Text, View } from "react-native";

import { snippet } from "./code-block-sample";

const CHECKOUT = snippet("checkout");

function LineChip({ line, onRemove }: { readonly line: number; readonly onRemove: React.Dispatch<React.SetStateAction<readonly number[]>> }): React.JSX.Element {
	const remove = React.useCallback((): void => {
		onRemove((current) => current.filter((candidate: number): boolean => candidate !== line));
	}, [line, onRemove]);
	return <Attachment name={`checkout.ts:${String(line)}`} icon={FileCodeIcon} size="xs" variant="muted" onRemove={remove} />;
}

// Reference lines in chat: the gutter's + adds a line to the message as a chip.
export function CodeBlock25Example(): React.JSX.Element {
	const [lines, setLines] = React.useState<readonly number[]>([]);
	const add = React.useCallback((line: number): void => {
		setLines((current) => (current.includes(line) ? current : [...current, line].sort((a, b) => a - b)));
	}, []);
	return (
		<View className="w-full gap-2">
			<CodeBlock
				code={CHECKOUT.code}
				lines={CHECKOUT.lines}
				caption="checkout.ts"
				showLineNumbers
				selectedLines={lines}
				lineAction={{ sign: "+", label: (line: number): string => `Add line ${String(line)} to the message`, onPress: add }}
				size="sm"
			/>
			<View className="flex-row flex-wrap items-center gap-1.5">
				{lines.length === 0 ? <Text className="text-caption font-sans text-muted-foreground">Add lines to ask about them.</Text> : null}
				{lines.map((line: number): React.JSX.Element => (
					<LineChip key={line} line={line} onRemove={setLines} />
				))}
			</View>
		</View>
	);
}

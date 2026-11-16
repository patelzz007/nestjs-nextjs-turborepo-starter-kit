import { Text, View } from "react-native";
import { Button } from "@workspace/ui-native/components/button";
import * as React from "react";

import { useToast } from "../../../toast/facade";

// A failed build: each failing file and line, in the code face.
interface BuildError {
	readonly location: string;
	readonly message: string;
}

const BUILD_ERRORS: readonly BuildError[] = [
	{ location: "src/api/auth.ts:42", message: "TypeError: undefined is not a function" },
	{ location: "src/utils/parse.ts:18", message: "SyntaxError: Unexpected token" },
];

const ERRORS = (
	<View className="gap-1">
		{BUILD_ERRORS.map((error: BuildError): React.JSX.Element => (
			<Text key={error.location} className="text-caption font-code text-invert-foreground">
				{`${error.location} — ${error.message}`}
			</Text>
		))}
	</View>
);

export function Sonner14Example(): React.JSX.Element {
	const toast = useToast();
	const shownId = React.useRef<number | null>(null);
	const close = React.useCallback((): void => {
		if (shownId.current !== null) {
			toast.dismissed(shownId.current);
		}
	}, [toast]);
	const show = React.useCallback((): void => {
		shownId.current = toast.error("Compilation error in 2 files. Fix errors before deploying.", {
			title: "Build Failed",
			look: "invert",
			content: ERRORS,
			actions: (
				<>
					<Button label="View Logs" size="xs" variant="secondary" onPress={close} />
					<Button label="Retry Build" size="xs" variant="destructive" onPress={close} />
				</>
			),
		});
	}, [close, toast]);
	return <Button label="Build Error Toast" variant="outline" onPress={show} className="self-center" />;
}

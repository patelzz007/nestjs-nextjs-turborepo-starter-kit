import { Badge } from "@workspace/ui-native/components/badge";
import * as React from "react";
import { View } from "react-native";

const TAGS: readonly string[] = ["React", "TypeScript", "Expo"];

function Tag({ label, onRemove }: { readonly label: string; readonly onRemove: (label: string) => void }): React.JSX.Element {
	const remove = React.useCallback((): void => {
		onRemove(label);
	}, [label, onRemove]);
	return <Badge label={label} variant="outline" onRemove={remove} />;
}

export function Badge21Example(): React.JSX.Element {
	const [tags, setTags] = React.useState<readonly string[]>(TAGS);
	const remove = React.useCallback((label: string): void => {
		setTags((current: readonly string[]): readonly string[] => current.filter((tag: string): boolean => tag !== label));
	}, []);
	return (
		<View className="flex-row flex-wrap gap-2">
			{tags.map((tag: string): React.JSX.Element => (
				<Tag key={tag} label={tag} onRemove={remove} />
			))}
		</View>
	);
}

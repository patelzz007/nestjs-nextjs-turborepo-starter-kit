import { FileType } from "@workspace/ui-native/components/file-type";
import * as React from "react";
import { Text, View } from "react-native";

interface BadgeRecipe {
	readonly type: string;
	readonly name: string;
	readonly label?: string | undefined;
	readonly band: string;
	readonly text?: string | undefined;
}

const RECIPES: readonly BadgeRecipe[] = [
	{ type: "pdf", name: "Pill", band: "rounded-full" },
	{ type: "docx", name: "Outline", band: "border border-tone-blue bg-background", text: "text-tone-blue" },
	{ type: "xlsx", name: "Inverted", band: "bg-foreground", text: "text-background" },
	{ type: "json", name: "Monospace", band: "", text: "font-code" },
	{ type: "docx", name: "Custom text", label: "DRAFT", band: "bg-tone-yellow", text: "text-tone-yellow-soft" },
	{ type: "pdf", name: "Bold", label: "NEW", band: "", text: "font-sans-bold tracking-wide" },
];

export function FileType14Example(): React.JSX.Element {
	return (
		<View className="gap-4">
			{RECIPES.map((recipe: BadgeRecipe): React.JSX.Element => (
				<View key={recipe.name} className="flex-row items-center gap-3">
					<FileType type={recipe.type} label={recipe.label} labelClassName={recipe.band} labelTextClassName={recipe.text} />
					<View className="flex-1">
						<Text numberOfLines={1} className="text-label font-sans-medium text-foreground">
							{recipe.name}
						</Text>
						<Text numberOfLines={1} className="text-caption font-code text-muted-foreground">
							{[recipe.band, recipe.text ?? ""].filter((part: string): boolean => part !== "").join(" · ")}
						</Text>
					</View>
				</View>
			))}
		</View>
	);
}

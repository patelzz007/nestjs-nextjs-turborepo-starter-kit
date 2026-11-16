import { getFileType } from "@workspace/ui-kit-logic";
import { FileType } from "@workspace/ui-native/components/file-type";
import * as React from "react";
import { Text, View } from "react-native";

const FILES: readonly string[] = [
	".env.local",
	".gitignore",
	".dockerignore",
	"Dockerfile",
	"Makefile",
	"wrangler.toml",
	"schema.prisma",
	"main.tf",
	"App.vue",
	"schema.graphql",
	"train.ipynb",
	"model.safetensors",
];

// Dotfiles and extensionless build files each resolve to a type of their own.
export function FileType15Example(): React.JSX.Element {
	return (
		<View accessibilityLabel="Repository files" className="flex-row flex-wrap gap-x-6 gap-y-3">
			{FILES.map((name: string): React.JSX.Element => (
				<View key={name} className="w-40 flex-row items-center gap-3">
					<FileType type={getFileType(name)} />
					<Text numberOfLines={1} className="text-label shrink font-sans text-foreground">
						{name}
					</Text>
				</View>
			))}
		</View>
	);
}

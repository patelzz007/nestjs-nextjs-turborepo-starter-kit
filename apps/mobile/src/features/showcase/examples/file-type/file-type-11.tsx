import type { FileTypeTone } from "@workspace/ui-kit-logic";
import { FileType } from "@workspace/ui-native/components/file-type";
import * as React from "react";
import { Text, View } from "react-native";

interface CustomFormat {
	readonly type: string;
	readonly name: string;
	readonly tone: FileTypeTone;
}

const FORMATS: readonly CustomFormat[] = [
	{ type: "dwg", name: "AutoCAD drawing", tone: "teal" },
	{ type: "stl", name: "3D print mesh", tone: "violet" },
	{ type: "blend", name: "Blender scene", tone: "orange" },
	{ type: "step", name: "CAD exchange", tone: "red" },
];

export function FileType11Example(): React.JSX.Element {
	return (
		<View className="gap-6">
			<View className="gap-3">
				{/* No visible text names these, so each keeps its own spoken name ("DWG file"). */}
				<View className="flex-row flex-wrap gap-3">
					{FORMATS.map((format: CustomFormat): React.JSX.Element => (
						<FileType key={format.type} type={format.type} />
					))}
				</View>
				<Text className="text-label font-sans text-muted-foreground">
					An extension outside the built-in table renders on a neutral page, labeled with the extension itself.
				</Text>
			</View>
			<View className="gap-3">
				{FORMATS.map((format: CustomFormat): React.JSX.Element => (
					<View key={format.type} className="flex-row items-center gap-3">
						<FileType type={format.type} tone={format.tone} />
						<View className="flex-1">
							<Text numberOfLines={1} className="text-label font-sans-medium text-foreground">
								{format.name}
							</Text>
							<Text className="text-caption font-code text-muted-foreground">{`tone="${format.tone}"`}</Text>
						</View>
					</View>
				))}
				<Text className="text-label font-sans text-muted-foreground">One tone recolours any type, and the label stays readable on it.</Text>
			</View>
		</View>
	);
}

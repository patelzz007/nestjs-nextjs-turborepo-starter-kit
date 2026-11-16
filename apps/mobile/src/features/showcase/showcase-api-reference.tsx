import { Badge } from "@workspace/ui-native/components/badge";
import * as React from "react";
import { Text, View } from "react-native";

import type { ApiEntry, ApiProp } from "./showcase-api";

/** The anchor of one entry's section (the web's `api-<name>`). */
export function apiAnchorOf(name: string): string {
	return `api-${name.toLowerCase()}`;
}

function PropRow({ prop }: { readonly prop: ApiProp }): React.JSX.Element {
	return (
		<View className="gap-1 border-t border-border py-3" testID={`showcase-api-prop-${prop.name}`}>
			<View className="flex-row flex-wrap items-center gap-2">
				<Text className="text-body font-code text-foreground">{prop.name}</Text>
				{prop.required ? <Badge label="Required" tone="warning" size="sm" /> : null}
			</View>
			<Text selectable className="text-caption font-code text-code-constant">
				{prop.type}
			</Text>
			{prop.defaultValue === null ? null : <Text className="text-caption font-sans text-muted-foreground">{`Default: ${prop.defaultValue}`}</Text>}
			{prop.description.length === 0 ? null : <Text className="text-body font-sans text-foreground">{prop.description}</Text>}
		</View>
	);
}

function EntrySection({ entry }: { readonly entry: ApiEntry }): React.JSX.Element {
	return (
		<View className="rounded-card gap-2 border border-border bg-card p-4" testID={`showcase-${apiAnchorOf(entry.name)}`}>
			<View className="flex-row flex-wrap items-center gap-2">
				<Text accessibilityRole="header" className="text-h4 font-code text-foreground">
					{entry.name}
				</Text>
				<Badge label={entry.kind} size="sm" />
			</View>
			<Text selectable className="text-caption font-code text-muted-foreground">
				{entry.module}
			</Text>
			{entry.description.length === 0 ? null : <Text className="text-body font-sans text-foreground">{entry.description}</Text>}
			{entry.signature === null ? null : (
				<Text selectable className="text-caption font-code text-code-function">
					{entry.signature}
				</Text>
			)}
			{entry.props.length === 0 ? null : (
				<View>
					{entry.props.map((prop: ApiProp): React.JSX.Element => (
						<PropRow key={prop.name} prop={prop} />
					))}
				</View>
			)}
			{entry.inherits.length === 0 ? null : <Text className="text-caption font-sans text-muted-foreground">{`Also accepts: ${entry.inherits.join(", ")}.`}</Text>}
		</View>
	);
}

/** The generated API reference: one section per export, its props (name, type, default, description) and what it inherits. */
export function ShowcaseApiReference({ entries }: { readonly entries: readonly ApiEntry[] }): React.JSX.Element {
	if (entries.length === 0) {
		return <Text className="text-body font-sans text-muted-foreground">This component exports nothing to document.</Text>;
	}
	return (
		<View className="gap-4" testID="showcase-api-reference">
			{entries.map((entry: ApiEntry): React.JSX.Element => (
				<EntrySection key={entry.name} entry={entry} />
			))}
		</View>
	);
}

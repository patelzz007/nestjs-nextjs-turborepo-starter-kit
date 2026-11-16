import { Button } from "@workspace/ui-native/components/button";
import { Input } from "@workspace/ui-native/components/input";
import { SignaturePad, useSignatureHistory } from "@workspace/ui-native/components/signature-pad";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@workspace/ui-native/components/tabs";
import * as React from "react";
import { Text, View } from "react-native";

import { ignorePress } from "../example-support";

export function SignaturePad6Example(): React.JSX.Element {
	const signature = useSignatureHistory();
	const [mode, setMode] = React.useState<string>("draw");
	const [name, setName] = React.useState<string>("");
	return (
		<View className="gap-3">
			<Tabs value={mode} onChange={setMode} variant="line">
				<TabsList>
					<TabsTrigger value="draw" label="Draw" />
					<TabsTrigger value="type" label="Type" />
				</TabsList>
				<TabsContent value="draw">
					<SignaturePad strokes={signature.strokes} onChange={signature.onChange} />
				</TabsContent>
				<TabsContent value="type">
					<View className="gap-3">
						<Input value={name} onChange={setName} accessibilityLabel="Your name" placeholder="Type your name" />
						<Text className="text-h2 font-sans text-foreground italic">{name}</Text>
					</View>
				</TabsContent>
			</Tabs>
			<Button label="Adopt and sign" onPress={ignorePress} />
		</View>
	);
}

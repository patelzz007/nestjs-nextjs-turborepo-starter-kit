import EraserIcon from "lucide-react-native/icons/eraser";
import Redo2Icon from "lucide-react-native/icons/redo-2";
import Undo2Icon from "lucide-react-native/icons/undo-2";
import { Button } from "@workspace/ui-native/components/button";
import { IconButton } from "@workspace/ui-native/components/icon-button";
import { SignaturePad, useSignatureHistory } from "@workspace/ui-native/components/signature-pad";
import * as React from "react";
import { View } from "react-native";

export function SignaturePad2Example(): React.JSX.Element {
	const signature = useSignatureHistory();
	return (
		<View className="gap-2">
			<View className="flex-row gap-1">
				<IconButton icon={Undo2Icon} label="Undo" variant="ghost" size="sm" disabled={!signature.canUndo} onPress={signature.undo} />
				<IconButton icon={Redo2Icon} label="Redo" variant="ghost" size="sm" disabled={!signature.canRedo} onPress={signature.redo} />
				<Button label="Clear" icon={EraserIcon} variant="ghost" size="sm" onPress={signature.clear} className="ml-auto" />
			</View>
			<SignaturePad strokes={signature.strokes} onChange={signature.onChange} />
		</View>
	);
}

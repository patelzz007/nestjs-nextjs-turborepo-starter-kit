import { Button } from "@workspace/ui-native/components/button";
import * as React from "react";
import { useFileUpload } from "@workspace/ui-native/lib/use-file-upload";

export function FileUploadDont1Example(): React.JSX.Element {
	const upload = useFileUpload({ accept: ["application/pdf"] });
	const choose = React.useCallback((): void => {
		upload.openPicker().catch((): void => {
			// Nothing was picked.
		});
	}, [upload]);
	return <Button label="Choose file" variant="outline" onPress={choose} />;
}

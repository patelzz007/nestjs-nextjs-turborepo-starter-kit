import { EmptyState } from "@workspace/ui-native/components/empty";
import { InputGroup } from "@workspace/ui-native/components/input-group";
import { Kbd } from "@workspace/ui-native/components/kbd";
import { TextLink } from "@workspace/ui-native/components/text-link";
import CircleDashedIcon from "lucide-react-native/icons/circle-dashed";
import * as React from "react";

import { ignorePress } from "../example-support";

const SLASH = <Kbd label="/" />;

export function Empty3Example(): React.JSX.Element {
	const [query, setQuery] = React.useState("");
	return (
		<EmptyState variant="outline" align="center" title="404 — Not Found" message="The screen you're looking for doesn't exist. Try searching for what you need below.">
			<InputGroup value={query} onChange={setQuery} leadingIcon={CircleDashedIcon} trailing={SLASH} placeholder="Try searching for screens…" className="w-full" />
			<TextLink leadIn="Need help?" label="Contact support" onPress={ignorePress} />
		</EmptyState>
	);
}

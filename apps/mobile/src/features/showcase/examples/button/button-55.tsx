import { Avatar } from "@workspace/ui-native/components/avatar";
import { Button } from "@workspace/ui-native/components/button";
import * as React from "react";

import { ignorePress, SAMPLE_PERSON } from "../example-support";

export function Button55Example(): React.JSX.Element {
	return <Button label={SAMPLE_PERSON.handle} leading={<Avatar name={SAMPLE_PERSON.name} imageUrl={SAMPLE_PERSON.imageUrl} size="sm" />} onPress={ignorePress} />;
}

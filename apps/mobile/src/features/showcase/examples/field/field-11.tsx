import LockIcon from "lucide-react-native/icons/lock";
import MailIcon from "lucide-react-native/icons/mail";
import { Field } from "@workspace/ui-native/components/field";
import { InputGroup } from "@workspace/ui-native/components/input-group";
import * as React from "react";
import { View } from "react-native";

/** The rules the password fails (the form's schema reports them). */
const PASSWORD_ERRORS: readonly string[] = ["At least 8 characters.", "At least one number."];

export function Field11Example(): React.JSX.Element {
	const [email, setEmail] = React.useState<string>("avery@");
	const [password, setPassword] = React.useState<string>("abc");
	return (
		<View className="gap-4">
			<Field label="Email" error="Enter a valid email address.">
				<InputGroup value={email} onChange={setEmail} leadingIcon={MailIcon} autoCapitalize="none" />
			</Field>
			<Field label="Password" errors={PASSWORD_ERRORS}>
				<InputGroup value={password} onChange={setPassword} leadingIcon={LockIcon} secureTextEntry />
			</Field>
		</View>
	);
}

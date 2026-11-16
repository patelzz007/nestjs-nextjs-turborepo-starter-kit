import { Field } from "@workspace/ui-native/components/field";
import { PasswordInput } from "@workspace/ui-native/components/password-input";
import { PasswordStrengthMeter, type PasswordStrengthCriterion } from "@workspace/ui-native/components/password-strength-meter";
import * as React from "react";
import { View } from "react-native";

interface Rule {
	readonly label: string;
	readonly test: RegExp;
}

/** The rules the sign-up form asks for. */
const RULES: readonly Rule[] = [
	{ label: "At least 8 characters", test: /.{8,}/u },
	{ label: "A lower-case letter", test: /[a-z]/u },
	{ label: "An upper-case letter", test: /[A-Z]/u },
	{ label: "A number", test: /\d/u },
];

/** What each count of met rules is called. */
const LEVELS: readonly string[] = ["Empty", "Weak", "Fair", "Good", "Strong"];
/** The meter's full bar, in percent. */
const FULL = 100;

export function PasswordStrengthMeter1Example(): React.JSX.Element {
	const [value, setValue] = React.useState<string>("");
	const criteria = RULES.map(({ label, test }: Rule): PasswordStrengthCriterion => ({ label, met: test.test(value) }));
	const met = criteria.filter((criterion: PasswordStrengthCriterion): boolean => criterion.met).length;
	return (
		<View className="gap-3">
			<Field label="New password">
				<PasswordInput value={value} onChange={setValue} />
			</Field>
			<PasswordStrengthMeter score={met} label={LEVELS.at(met) ?? ""} percent={(met / RULES.length) * FULL} criteria={criteria} />
		</View>
	);
}

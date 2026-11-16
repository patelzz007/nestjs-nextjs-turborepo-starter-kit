import { Field } from "@workspace/ui-native/components/field";
import { PasswordInput } from "@workspace/ui-native/components/password-input";
import { PasswordStrengthMeter, type PasswordStrengthCriterion } from "@workspace/ui-native/components/password-strength-meter";
import * as React from "react";
import { View } from "react-native";

interface Rule {
	readonly label: string;
	readonly test: RegExp;
}

const RULES: readonly Rule[] = [
	{ label: "At least 8 characters", test: /.{8,}/u },
	{ label: "A lower-case letter", test: /[a-z]/u },
	{ label: "An upper-case letter", test: /[A-Z]/u },
	{ label: "A number", test: /\d/u },
	{ label: "A symbol", test: /[^\w\s]/u },
];

/** What each count of met rules is called. */
const LEVELS: readonly string[] = ["Empty", "Very weak", "Weak", "Fair", "Strong", "Very strong"];

export function Input23Example(): React.JSX.Element {
	const [value, setValue] = React.useState<string>("");
	const criteria = RULES.map(({ label, test }: Rule): PasswordStrengthCriterion => ({ label, met: test.test(value) }));
	const met = criteria.filter((criterion: PasswordStrengthCriterion): boolean => criterion.met).length;
	return (
		<View className="gap-3">
			<Field label="Password">
				<PasswordInput value={value} onChange={setValue} />
			</Field>
			<PasswordStrengthMeter score={met} label={LEVELS.at(met) ?? ""} percent={(met / RULES.length) * 100} criteria={criteria} />
		</View>
	);
}

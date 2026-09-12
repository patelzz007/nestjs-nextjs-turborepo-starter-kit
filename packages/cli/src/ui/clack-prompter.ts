import * as p from "@clack/prompts";

import type { PromptChoice, WizardPrompter } from "../wizard/prompter";

function isNotCancel<T>(value: T | symbol): value is T {
	return !p.isCancel(value);
}

function exitOnCancel<T>(value: T | symbol): T {
	if (!isNotCancel(value)) {
		p.cancel("Cancelled.");
		process.exit(0);
	}
	return value;
}

export function createClackPrompter(): WizardPrompter {
	return {
		async text(message, options): Promise<string> {
			const result = await p.text({
				message,
				placeholder: options?.defaultValue ?? "",
				validate: (value) => {
					const raw = value ?? "";
					const trimmed = raw.trim();
					const candidate = trimmed.length > 0 ? trimmed : (options?.defaultValue ?? "");
					return options?.validate?.(candidate);
				},
			});
			const resolved = exitOnCancel(result);
			const trimmed = (resolved ?? "").trim();
			return trimmed.length > 0 ? trimmed : (options?.defaultValue ?? "");
		},

		async confirm(message, options): Promise<boolean> {
			const result = await p.confirm({
				message,
				active: "yes",
				inactive: "no",
				initialValue: options?.defaultValue ?? true,
			});
			return exitOnCancel(result);
		},

		async select(message, choices: readonly PromptChoice<string>[]): Promise<string> {
			const result = await p.select({
				message,
				options: choices.map((choice) => ({
					value: choice.value,
					label: choice.label,
					hint: choice.hint,
				})),
			});
			return exitOnCancel(result);
		},

		async multiselect(message, choices: readonly PromptChoice<string>[]): Promise<string[]> {
			const result = await p.multiselect({
				message,
				options: choices.map((choice) => ({
					value: choice.value,
					label: choice.label,
					hint: choice.hint,
				})),
			});
			return exitOnCancel(result);
		},

		close(): void {
			// Clack manages its own readline lifecycle.
		},
	};
}

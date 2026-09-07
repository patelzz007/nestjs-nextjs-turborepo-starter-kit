import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

import pc from "picocolors";

export interface PromptChoice<T extends string> {
	readonly value: T;
	readonly label: string;
	readonly hint?: string;
}

export interface WizardPrompter {
	text(message: string, options?: { defaultValue?: string; hint?: string; validate?: (value: string) => string | undefined }): Promise<string>;
	confirm(message: string, options?: { defaultValue?: boolean; hint?: string }): Promise<boolean>;
	select(message: string, choices: readonly PromptChoice<string>[], options?: { hint?: string }): Promise<string>;
	multiselect(message: string, choices: readonly PromptChoice<string>[], options?: { hint?: string }): Promise<string[]>;
	close(): void;
}

export function createReadlinePrompter(): WizardPrompter {
	const rl = createInterface({ input, output });

	return {
		async text(message, options): Promise<string> {
			if (options?.hint !== undefined) {
				output.write(`${pc.dim(`  ${options.hint}`)}\n`);
			}
			const defaultSuffix = options?.defaultValue !== undefined ? pc.dim(` (default: ${options.defaultValue})`) : "";
			while (true) {
				const raw = await rl.question(`${pc.bold(message)}${defaultSuffix}\n${pc.cyan(">")} `);
				const value = raw.trim().length > 0 ? raw.trim() : (options?.defaultValue ?? "");
				const error = options?.validate?.(value);
				if (error !== undefined) {
					output.write(`${pc.red(error)}\n`);
					continue;
				}
				return value;
			}
		},

		async confirm(message, options): Promise<boolean> {
			if (options?.hint !== undefined) {
				output.write(`${pc.dim(`  ${options.hint}`)}\n`);
			}
			const defaultValue = options?.defaultValue ?? true;
			const hint = defaultValue ? pc.dim("Y/n") : pc.dim("y/N");
			while (true) {
				const raw = await rl.question(`${pc.bold(message)} [${hint}]\n${pc.cyan(">")} `);
				if (raw.trim().length === 0) {
					return defaultValue;
				}
				const normalized = raw.trim().toLowerCase();
				if (normalized === "y" || normalized === "yes") {
					return true;
				}
				if (normalized === "n" || normalized === "no") {
					return false;
				}
				output.write(`${pc.red("Please answer y or n.")}\n`);
			}
		},

		async select(message, choices, options): Promise<string> {
			if (options?.hint !== undefined) {
				output.write(`${pc.dim(`  ${options.hint}`)}\n`);
			}
			output.write(`${pc.bold(message)}\n`);
			for (let index = 0; index < choices.length; index += 1) {
				const choice = choices[index];
				if (choice !== undefined) {
					const hint = choice.hint !== undefined ? pc.dim(` — ${choice.hint}`) : "";
					output.write(`  ${pc.cyan(String(index + 1))}. ${choice.label}${hint}\n`);
				}
			}
			while (true) {
				const raw = await rl.question(`${pc.dim(`Enter 1-${String(choices.length)}`)}\n${pc.cyan(">")} `);
				const parsed = Number.parseInt(raw.trim(), 10);
				if (!Number.isNaN(parsed) && parsed >= 1 && parsed <= choices.length) {
					const choice = choices[parsed - 1];
					if (choice !== undefined) {
						return choice.value;
					}
				}
				output.write(`${pc.red(`Enter a number between 1 and ${String(choices.length)}.`)}\n`);
			}
		},

		async multiselect(message, choices, options): Promise<string[]> {
			if (options?.hint !== undefined) {
				output.write(`${pc.dim(`  ${options.hint}`)}\n`);
			}
			output.write(`${pc.bold(message)}\n`);
			for (let index = 0; index < choices.length; index += 1) {
				const choice = choices[index];
				if (choice !== undefined) {
					const hint = choice.hint !== undefined ? pc.dim(` — ${choice.hint}`) : "";
					output.write(`  ${pc.cyan(String(index + 1))}. ${choice.label}${hint}\n`);
				}
			}
			while (true) {
				const raw = await rl.question(`${pc.dim("Enter numbers separated by commas (e.g. 1,2)")}\n${pc.cyan(">")} `);
				const indexes = raw
					.split(",")
					.map((part) => Number.parseInt(part.trim(), 10))
					.filter((value) => !Number.isNaN(value));
				const selected = indexes
					.map((index) => choices[index - 1]?.value)
					.filter((value): value is string => value !== undefined);
				if (selected.length > 0) {
					return selected;
				}
				output.write(`${pc.red("Select at least one module.")}\n`);
			}
		},

		close(): void {
			rl.close();
		},
	};
}

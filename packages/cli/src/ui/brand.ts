import pc from "picocolors";

export const CLI_NAME = "app";
export const CLI_TAGLINE = "Contract-driven scaffolding for your monorepo";
export const CLI_VERSION = "0.1.0";

const BANNER_LINES: readonly string[] = ["   ___   ____  ____ ", "  / _ \\ |  _ \\|  _ \\", " | |_| || |_) | |_) |", "  \\___/ |  __/|  __/", "        |_|   |_|   "];

const BANNER_COLORS: readonly ((value: string) => string)[] = [pc.cyan, pc.blue, pc.magenta, pc.cyan, pc.dim];

export function printAppBanner(): void {
	process.stdout.write("\n");
	for (let index = 0; index < BANNER_LINES.length; index += 1) {
		const line = BANNER_LINES[index];
		const color = BANNER_COLORS[index] ?? pc.cyan;
		if (line !== undefined) {
			process.stdout.write(`${color(line)}\n`);
		}
	}
	process.stdout.write(`${pc.bold(pc.white(" app"))} ${pc.dim(`v${CLI_VERSION}`)}  ${pc.dim("—")}  ${pc.dim(CLI_TAGLINE)}\n\n`);
}

export function isInteractiveTerminal(): boolean {
	return process.stdin.isTTY && process.stdout.isTTY;
}

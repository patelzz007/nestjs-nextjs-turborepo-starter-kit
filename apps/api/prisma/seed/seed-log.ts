/**
 * The seed CLI's output channel. Progress lines and the credential/summary
 * tables are the seed's user-facing output, so they go to stdout explicitly
 * (diagnostics still use console.warn / console.error → stderr).
 */
export function seedLog(message: string): void {
	process.stdout.write(`${message}\n`);
}

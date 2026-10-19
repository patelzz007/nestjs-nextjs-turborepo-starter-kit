/** The command line is invalid (unknown flag, missing value, secret on argv, or an unusable password source). */
export class BootstrapUsageError extends Error {
	public constructor(message: string) {
		super(message);
		this.name = "BootstrapUsageError";
	}
}

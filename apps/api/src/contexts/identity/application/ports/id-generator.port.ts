/** New aggregate ids (UUID v4), chosen before insert so tokens and audit rows can reference them. */
export interface IdGeneratorPort {
	next(): string;
}

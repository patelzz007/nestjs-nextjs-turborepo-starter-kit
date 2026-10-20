/** Who ran a CLI command (OS user and host), recorded in its audit rows next to the system actor. */
export interface OperatorIdentity {
	readonly osUser: string;
	readonly host: string;
}

export interface OperatorIdentityPort {
	current(): OperatorIdentity;
}

export const OPERATOR_IDENTITY = Symbol("OPERATOR_IDENTITY");

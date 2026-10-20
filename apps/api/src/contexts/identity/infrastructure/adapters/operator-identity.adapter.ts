import { NodeOperatorIdentityProvider } from "../../../../platform/infrastructure/operator-identity";
import type { OperatorIdentity, OperatorIdentityPort } from "../../application/ports/operator-identity.port";

/** The OS user and host of the process (the CLI's audit detail). */
export class NodeOperatorIdentity implements OperatorIdentityPort {
	private readonly provider = new NodeOperatorIdentityProvider();

	public current(): OperatorIdentity {
		return this.provider.current();
	}
}

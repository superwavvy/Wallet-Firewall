export interface SimulationResult {
  success: boolean;
  // true  = the call would fail on-chain (revert, out of gas, insufficient funds)
  // false = the call failed for another reason, e.g. RPC/network error (outcome unknown)
  reverted: boolean;
  data?: string;
  error?: string;
}

export async function simulateTransaction(
  client: any,
  tx: { to: string; value: string; data: string },
  fromAddress: string,
  opts?: { fundSender?: boolean }
): Promise<SimulationResult> {
  try {
    const callData = {
      account: fromAddress as `0x${string}`,
      to: tx.to as `0x${string}`,
      value: BigInt(tx.value),
      data: (tx.data || '0x') as `0x${string}`,
      // Demo mode: pretend the placeholder sender holds 1000 ETH so transfers don't revert
      ...(opts?.fundSender
        ? { stateOverride: [{ address: fromAddress as `0x${string}`, balance: BigInt('1000000000000000000000') }] }
        : {}),
    };

    const result = await client.call(callData);
    return { success: true, reverted: false, data: result.data };
  } catch (error: any) {
    const text = `${error?.shortMessage ?? ''} ${error?.details ?? ''} ${error?.message ?? ''}`;
    const reverted = /revert|insufficient funds|out of gas/i.test(text);
    return {
      success: false,
      reverted,
      error: error?.shortMessage || error?.message || 'Simulation failed',
    };
  }
}

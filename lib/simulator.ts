export interface SimulationResult {
  success: boolean;
  // true  = the call would fail on-chain (revert, out of gas, insufficient funds)
  // false = failed for another reason, e.g. RPC/network error (outcome unknown)
  reverted: boolean;
  data?: string;
  error?: string;
}

export async function simulateTransaction(
  client: any,
  tx: { to: string; value: string; data: string },
  fromAddress: string
): Promise<SimulationResult> {
  try {
    const callData = {
      account: fromAddress as `0x${string}`,
      to: tx.to as `0x${string}`,
      value: BigInt(tx.value),
      data: (tx.data || '0x') as `0x${string}`,
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

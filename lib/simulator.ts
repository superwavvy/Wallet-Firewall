export async function simulateTransaction(client: any, tx: { to: string; value: string; data: string }, fromAddress: string) {
  try {
    const callData = {
      account: fromAddress as `0x${string}`,
      to: tx.to as `0x${string}`,
      value: BigInt(tx.value),
      data: (tx.data || '0x') as `0x${string}`,
    };
    
    const result = await client.call(callData);
    return { success: true, data: result.data };
  } catch (error: any) {
    return { success: false, error: error.message || 'Simulation reverted' };
  }
}

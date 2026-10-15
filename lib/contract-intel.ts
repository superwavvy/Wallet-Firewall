import { isAddress } from 'viem';

export async function getContractIntel(client: any, address: string) {
  if (!isAddress(address)) return null;

  try {
    const [bytecode, balance, nonce] = await Promise.all([
      client.getBytecode({ address: address as `0x${string}` }),
      client.getBalance({ address: address as `0x${string}` }),
      client.getTransactionCount({ address: address as `0x${string}` }),
    ]);

    const isContract = bytecode !== undefined && bytecode !== '0x';
    
    return {
      address,
      isContract,
      bytecodeSize: isContract ? (bytecode.length - 2) / 2 : 0,
      balance: balance.toString(),
      nonce,
    };
  } catch (error) {
    console.error('Failed to fetch contract intel:', error);
    return { error: 'Failed to fetch contract data' };
  }
}

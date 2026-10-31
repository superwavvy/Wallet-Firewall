import { isAddress } from 'viem';

// EIP-7702: a delegated EOA stores 23 bytes of code: 0xef0100 + 20-byte delegate address.
const DELEGATION_PREFIX = '0xef0100';

export function parseDelegation(bytecode?: string | null): string | null {
  if (!bytecode) return null;
  const code = bytecode.toLowerCase();
  // "0x" (2) + "ef0100" (6) + address (40) = 48 characters
  if (code.length === 48 && code.startsWith(DELEGATION_PREFIX)) {
    return `0x${code.slice(8)}`;
  }
  return null;
}

export async function getContractIntel(client: any, address: string) {
  if (!isAddress(address)) return null;

  try {
    const [bytecode, balance, nonce] = await Promise.all([
      client.getBytecode({ address: address as `0x${string}` }),
      client.getBalance({ address: address as `0x${string}` }),
      client.getTransactionCount({ address: address as `0x${string}` }),
    ]);

    const hasCode = bytecode !== undefined && bytecode !== '0x';
    const delegateAddress = parseDelegation(bytecode);
    const isDelegated = delegateAddress !== null;

    return {
      address,
      // true for real contracts AND delegated EOAs, because both run code when called
      isContract: hasCode,
      isDelegated,
      delegateAddress,
      bytecodeSize: hasCode ? (bytecode.length - 2) / 2 : 0,
      balance: balance.toString(),
      nonce,
    };
  } catch (error) {
    console.error('Failed to fetch contract intel:', error);
    return { error: 'Failed to fetch contract data' };
  }
}

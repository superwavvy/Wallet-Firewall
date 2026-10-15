export function decodeTransaction(tx: { to: string; value: string; data: string }) {
  if (!tx.data || tx.data === '0x' || tx.data.length < 10) {
    return { type: 'NATIVE_TRANSFER', value: tx.value };
  }

  const selector = tx.data.slice(0, 10);
  
  const selectorMap: Record<string, string> = {
    // Standard ERC20
    '0xa9059cbb': 'transfer(address,uint256)',
    '0x095ea7b3': 'approve(address,uint256)',
    '0x23b872dd': 'transferFrom(address,address,uint256)',
    '0x70a08231': 'balanceOf(address)',
    
    // NFTs
    '0x42842e0e': 'safeTransferFrom(address,address,uint256)',
    '0xb88d4fde': 'safeTransferFrom(address,address,uint256,bytes)',
    
    // WETH / Utility
    '0x2e1a7d4d': 'withdraw(uint256)',
    '0xd0e30db0': 'deposit()',
    
    // Multicall (Dangerous because it hides multiple calls)
    '0xac9650d8': 'multicall(bytes[])',
    '0x252dba42': 'multicall(bytes32[])',
    
    // Permit / Permit2 (Off-chain approval signatures)
    '0xd505accf': 'permit(address,address,uint256,uint256,uint8,bytes32,bytes32)', // EIP-2612
    '0x87517c45': 'approve(address,address,uint160,uint48)', // Permit2 approve
    '0x2b67b570': 'permit(address,address,uint160,uint48,uint256,bytes)', // Permit2 permit
  };

  const functionName = selectorMap[selector];

  if (functionName) {
    return {
      type: 'CONTRACT_CALL',
      selector,
      functionName,
      rawData: tx.data,
    };
  }

  return {
    type: 'UNKNOWN_SELECTOR',
    selector,
    rawData: tx.data,
  };
}

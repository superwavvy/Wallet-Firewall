export interface RiskSignal {
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  scoreContribution: number;
  isHardBlock: boolean;
  explanation: string;
  evidence: string;
  recommendation: string;
}

export interface RiskReport {
  score: number;
  verdict: 'SAFE' | 'REVIEW' | 'BLOCK';
  signals: RiskSignal[];
}

export function analyzeRisk(rawTx: any, decodedTx: any, intel: any): RiskReport {
  const signals: RiskSignal[] = [];
  let score = 0;
  let isHardBlock = false;

  // 1. Native Transfer Check
  if (decodedTx.type === 'NATIVE_TRANSFER' && BigInt(rawTx.value) > 0n) {
    signals.push({
      severity: 'LOW',
      scoreContribution: 5,
      isHardBlock: false,
      explanation: 'Standard native ETH transfer.',
      evidence: `Value: ${rawTx.value} wei`,
      recommendation: 'Proceed with normal caution.'
    });
    score += 5;
  }

  // 2. Unknown Selector Check
  if (decodedTx.type === 'UNKNOWN_SELECTOR') {
    signals.push({
      severity: 'HIGH',
      scoreContribution: 40,
      isHardBlock: false,
      explanation: 'Transaction calls a function with an unrecognized selector.',
      evidence: `Selector: ${decodedTx.selector}`,
      recommendation: 'Verify the contract and function signature before signing.'
    });
    score += 40;
  }

  // 3. Calldata to EOA Check (Hard Block)
  if (intel && intel.isContract === false && rawTx.data && rawTx.data !== '0x') {
    signals.push({
      severity: 'CRITICAL',
      scoreContribution: 100,
      isHardBlock: true,
      explanation: 'Calldata sent to an externally owned account (EOA).',
      evidence: `Address ${intel.address} has no bytecode.`,
      recommendation: 'Do not sign. Sending calldata to an EOA will likely result in lost funds.'
    });
    score = 100;
    isHardBlock = true;
  }

  // 4. Contract Call Analysis
  if (decodedTx.type === 'CONTRACT_CALL') {
    
    // Unlimited Approval (ERC20)
    if (decodedTx.selector === '0x095ea7b3') {
      const calldata = rawTx.data.toLowerCase();
      if (calldata.length >= 138) {
        const amountHex = calldata.slice(-64);
        const maxUint256 = 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';
        if (amountHex === maxUint256) {
          signals.push({
            severity: 'CRITICAL',
            scoreContribution: 100,
            isHardBlock: true,
            explanation: 'Unlimited ERC20 approval detected.',
            evidence: `Approval amount is max uint256 (unlimited).`,
            recommendation: 'DO NOT SIGN. Limit the approval amount to exactly what is needed.'
          });
          score = 100;
          isHardBlock = true;
        } else {
          signals.push({
            severity: 'MEDIUM',
            scoreContribution: 25,
            isHardBlock: false,
            explanation: 'ERC20 approval detected.',
            evidence: `Function: approve(address,uint256)`,
            recommendation: 'Check the spender address and the allowance amount carefully.'
          });
          score += 25;
        }
      }
    }

    // Multicall (Hides multiple actions)
    if (decodedTx.functionName && decodedTx.functionName.includes('multicall')) {
      signals.push({
        severity: 'MEDIUM',
        scoreContribution: 30,
        isHardBlock: false,
        explanation: 'Multicall detected. This transaction bundles multiple actions together.',
        evidence: `Function: ${decodedTx.functionName}`,
        recommendation: 'Review all sub-calls carefully. Multicalls can hide malicious approvals or transfers.'
      });
      score += 30;
    }

    // Permit / Permit2 (Off-chain approvals)
    if (decodedTx.functionName && (decodedTx.functionName.includes('permit') || decodedTx.functionName.includes('Permit2'))) {
      signals.push({
        severity: 'HIGH',
        scoreContribution: 50,
        isHardBlock: false,
        explanation: 'Off-chain approval signature detected (Permit/Permit2).',
        evidence: `Function: ${decodedTx.functionName}`,
        recommendation: 'This grants token spending permission via signature. Verify the spender and amount before signing.'
      });
      score += 50;
    }

    // TransferFrom
    if (decodedTx.functionName && decodedTx.functionName.includes('transferFrom')) {
      signals.push({
        severity: 'HIGH',
        scoreContribution: 50,
        isHardBlock: false,
        explanation: 'Token transfer initiated by a third party.',
        evidence: `Function: ${decodedTx.functionName}`,
        recommendation: 'Ensure you trust the sender and the amount being transferred.'
      });
      score += 50;
    }
  }

  // Clamp score
  if (score > 100) score = 100;

  let verdict: 'SAFE' | 'REVIEW' | 'BLOCK' = 'SAFE';
  if (isHardBlock || score >= 80) {
    verdict = 'BLOCK';
  } else if (score >= 30) {
    verdict = 'REVIEW';
  }

  return { score, verdict, signals };
}

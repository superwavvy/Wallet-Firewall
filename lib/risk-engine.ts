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

// Delegate contracts you have vetted (lowercase). Empty = every delegation is unverified.
const KNOWN_DELEGATES: string[] = [];

const isKnownDelegate = (addr: string) => KNOWN_DELEGATES.includes(addr.toLowerCase());

export function analyzeRisk(rawTx: any, decodedTx: any, intel: any, senderIntel?: any, simulation?: any): RiskReport {
  const signals: RiskSignal[] = [];
  let score = 0;
  let isHardBlock = false;

  // 0. Fail-safe: if we could not inspect the target, block. Never fail open.
  if (!intel || intel.error) {
    signals.push({
      severity: 'CRITICAL',
      scoreContribution: 100,
      isHardBlock: true,
      explanation: 'Could not fetch information about the target address.',
      evidence: intel?.error ?? 'Target address is invalid or intel is unavailable.',
      recommendation: 'Do not sign until the target can be inspected.'
    });
    score = 100;
    isHardBlock = true;
  }

  // 1. Native Transfer Check
  if (decodedTx.type === 'NATIVE_TRANSFER' && BigInt(rawTx.value ?? 0) > 0n) {
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

  // 3b. Target is a 7702-delegated account
  if (intel && intel.isDelegated) {
    signals.push({
      severity: 'HIGH',
      scoreContribution: 35,
      isHardBlock: false,
      explanation: 'Target is an EOA delegated via EIP-7702. Its behavior is controlled by another contract.',
      evidence: `Delegated to ${intel.delegateAddress}`,
      recommendation: 'Verify the delegate contract before interacting.'
    });
    score += 35;
  }

  // 3c. Sender (the user's own wallet) is already delegated
  if (senderIntel && senderIntel.isDelegated) {
    signals.push({
      severity: 'HIGH',
      scoreContribution: 35,
      isHardBlock: false,
      explanation: 'Your own wallet is currently delegated to a contract (EIP-7702).',
      evidence: `Delegated to ${senderIntel.delegateAddress}`,
      recommendation: 'If you do not recognize this delegate, treat the wallet as compromised and move funds.'
    });
    score += 35;
  }

  // 3d. Transaction carries EIP-7702 authorizations
  const auths: any[] = Array.isArray(rawTx.authorizationList) ? rawTx.authorizationList : [];
  for (const auth of auths) {
    const delegate = String(auth.address ?? '');
    if (!isKnownDelegate(delegate)) {
      signals.push({
        severity: 'CRITICAL',
        scoreContribution: 100,
        isHardBlock: true,
        explanation: 'EIP-7702 authorization to an unverified contract. It can give that contract full control of your account.',
        evidence: `Delegate: ${delegate}`,
        recommendation: 'DO NOT SIGN unless you deployed or fully trust this delegate.'
      });
      score = 100;
      isHardBlock = true;
    }
    if (Number(auth.chainId) === 0) {
      signals.push({
        severity: 'HIGH',
        scoreContribution: 30,
        isHardBlock: false,
        explanation: 'Authorization uses chainId 0, so it is valid on every chain.',
        evidence: 'chainId: 0',
        recommendation: 'Prefer authorizations scoped to a single chain.'
      });
      score += 30;
    }
  }

  // 3e. Simulation result (only when a simulation was actually run)
  if (simulation && !simulation.success) {
    if (simulation.reverted) {
      signals.push({
        severity: 'HIGH',
        scoreContribution: 40,
        isHardBlock: false,
        explanation: 'Simulation shows this transaction would fail on-chain.',
        evidence: simulation.error ?? 'Reverted',
        recommendation: 'Signing will likely waste gas. Check the target, amount and calldata.'
      });
      score += 40;
    } else {
      signals.push({
        severity: 'MEDIUM',
        scoreContribution: 30,
        isHardBlock: false,
        explanation: 'Simulation could not be completed, so the outcome is unknown.',
        evidence: simulation.error ?? 'Simulation unavailable',
        recommendation: 'Retry the analysis before signing.'
      });
      score += 30;
    }
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

    // Permit2 approve: 0x87517c45 -> approve(address,address,uint160,uint48).
    // Grants a spender an allowance through Permit2 - the pattern in most approval-drainer thefts.
    if (decodedTx.selector === '0x87517c45') {
      signals.push({
        severity: 'MEDIUM',
        scoreContribution: 30,
        isHardBlock: false,
        explanation: 'Permit2 approval detected. It grants a spender an allowance over your tokens.',
        evidence: 'Permit2 approve (selector 0x87517c45)',
        recommendation: 'Verify the spender and amount, and revoke unused Permit2 allowances.'
      });
      score += 30;
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

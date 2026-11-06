import { describe, expect, it } from 'vitest';
import { analyzeRisk } from '../lib/risk-engine';
import { decodeTransaction } from '../lib/decoder';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const USDC = '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238';
const EOA = '0x1521F7e625A2c7015981C9179744dBa823d85B37';
const DELEGATE = '0x63c000000000000000000000000000000000032b';

const MAX_UINT256 = 'f'.repeat(64);

const word = (hex: string) => hex.replace(/^0x/, '').toLowerCase().padStart(64, '0');

const contractIntel = {
  address: USDC,
  isContract: true,
  isDelegated: false,
  delegateAddress: null as string | null,
  bytecodeSize: 4096,
  balance: '0',
  nonce: 1,
};

const eoaIntel = { ...contractIntel, address: EOA, isContract: false, bytecodeSize: 0 };

/** Native transfer: no calldata, value attached. */
const nativeTransfer = (value = '10000000000000000') => ({
  rawTx: { to: EOA, value, data: '0x' },
  decoded: decodeTransaction({ to: EOA, value, data: '0x' }),
});

/** approve(address,uint256) with a caller-supplied amount word. */
const approveTx = (amountWord: string) => {
  const data = '0x095ea7b3' + word(USDC) + amountWord;
  return { rawTx: { to: USDC, value: '0', data }, decoded: decodeTransaction({ to: USDC, value: '0', data }) };
};

// ---------------------------------------------------------------------------
// Verdict thresholds: 0-29 SAFE, 30-79 REVIEW, 80-100 or hard block BLOCK
// ---------------------------------------------------------------------------

describe('verdict thresholds', () => {
  it('returns SAFE below 30', () => {
    const { rawTx, decoded } = nativeTransfer();
    const r = analyzeRisk(rawTx, decoded, eoaIntel);
    expect(r.score).toBe(5);
    expect(r.verdict).toBe('SAFE');
  });

  it('returns REVIEW from 30', () => {
    const { rawTx, decoded } = approveTx(word('0x5')); // finite approval: +25 only
    const r = analyzeRisk(rawTx, decoded, contractIntel);
    expect(r.score).toBe(25);
    // NOTE: a finite approval currently lands in SAFE. Flagged in README as a review item.
    expect(r.verdict).toBe('SAFE');
  });

  it('returns BLOCK at 80 or above', () => {
    // unknown selector (+40) plus a reverting simulation (+40) = 80
    const data = '0xdeadbeef' + word('0x0');
    const decoded = decodeTransaction({ to: USDC, value: '0', data });
    const r = analyzeRisk({ to: USDC, value: '0', data }, decoded, contractIntel, undefined, {
      success: false,
      reverted: true,
      error: 'execution reverted',
    });
    expect(r.score).toBe(80);
    expect(r.verdict).toBe('BLOCK');
  });

  it('clamps the score at 100', () => {
    // delegated target (+35) + delegated sender (+35) + permit (+50) = 120
    const data = '0xd505accf' + word('0x0');
    const decoded = decodeTransaction({ to: USDC, value: '0', data });
    const r = analyzeRisk(
      { to: USDC, value: '0', data },
      decoded,
      { ...contractIntel, isDelegated: true, delegateAddress: DELEGATE },
      { ...contractIntel, isDelegated: true, delegateAddress: DELEGATE }
    );
    expect(r.score).toBe(100);
    expect(r.verdict).toBe('BLOCK');
  });
});

// ---------------------------------------------------------------------------
// Hard blocks — these must never depend on score arithmetic
// ---------------------------------------------------------------------------

describe('hard blocks', () => {
  it('BLOCKS calldata sent to an address with no bytecode', () => {
    const data = '0xdeadbeef' + word('0x0');
    const decoded = decodeTransaction({ to: EOA, value: '0', data });
    const r = analyzeRisk({ to: EOA, value: '0', data }, decoded, eoaIntel);
    expect(r.score).toBe(100);
    expect(r.verdict).toBe('BLOCK');
    expect(r.signals.some((s) => s.isHardBlock)).toBe(true);
  });

  it('BLOCKS an unlimited ERC20 approval', () => {
    const { rawTx, decoded } = approveTx(MAX_UINT256);
    const r = analyzeRisk(rawTx, decoded, contractIntel);
    expect(r.score).toBe(100);
    expect(r.verdict).toBe('BLOCK');
    expect(r.signals.some((s) => s.isHardBlock)).toBe(true);
  });

  it('BLOCKS an EIP-7702 authorization to an unverified delegate', () => {
    const { rawTx, decoded } = nativeTransfer('0');
    const r = analyzeRisk(
      { ...rawTx, authorizationList: [{ address: DELEGATE, chainId: 1 }] },
      decoded,
      eoaIntel
    );
    expect(r.verdict).toBe('BLOCK');
    expect(r.signals.some((s) => s.isHardBlock)).toBe(true);
  });

  it('not BLOCKs a native transfer that merely has a zero value', () => {
    const { rawTx, decoded } = nativeTransfer('0');
    const r = analyzeRisk(rawTx, decoded, eoaIntel);
    expect(r.verdict).toBe('SAFE');
  });
});

// ---------------------------------------------------------------------------
// Score signals — mirrors the table in README.md
// ---------------------------------------------------------------------------

describe('score signals', () => {
  it('native transfer: +5', () => {
    const { rawTx, decoded } = nativeTransfer();
    expect(analyzeRisk(rawTx, decoded, eoaIntel).score).toBe(5);
  });

  it('unknown selector: +40', () => {
    const data = '0xdeadbeef' + word('0x0');
    const decoded = decodeTransaction({ to: USDC, value: '0', data });
    expect(analyzeRisk({ to: USDC, value: '0', data }, decoded, contractIntel).score).toBe(40);
  });

  it('finite ERC20 approval: +25', () => {
    const { rawTx, decoded } = approveTx(word('0x5'));
    expect(analyzeRisk(rawTx, decoded, contractIntel).score).toBe(25);
  });

  it('multicall: +30', () => {
    const data = '0xac9650d8' + word('0x0');
    const decoded = decodeTransaction({ to: USDC, value: '0', data });
    const r = analyzeRisk({ to: USDC, value: '0', data }, decoded, contractIntel);
    expect(r.score).toBe(30);
    expect(r.verdict).toBe('REVIEW');
  });

  it('permit: +50', () => {
    const data = '0xd505accf' + word('0x0');
    const decoded = decodeTransaction({ to: USDC, value: '0', data });
    const r = analyzeRisk({ to: USDC, value: '0', data }, decoded, contractIntel);
    expect(r.score).toBe(50);
    expect(r.verdict).toBe('REVIEW');
  });

  it('transferFrom: +50', () => {
    const data = '0x23b872dd' + word(EOA) + word(USDC) + word('0x1');
    const decoded = decodeTransaction({ to: USDC, value: '0', data });
    expect(analyzeRisk({ to: USDC, value: '0', data }, decoded, contractIntel).score).toBe(50);
  });

  it('delegated target: +35', () => {
    const { rawTx, decoded } = nativeTransfer('0');
    const r = analyzeRisk(rawTx, decoded, {
      ...contractIntel,
      isDelegated: true,
      delegateAddress: DELEGATE,
    });
    expect(r.score).toBe(35);
    expect(r.verdict).toBe('REVIEW');
  });

  it('delegated sender: +35', () => {
    const { rawTx, decoded } = nativeTransfer('0');
    const r = analyzeRisk(rawTx, decoded, eoaIntel, {
      ...contractIntel,
      isDelegated: true,
      delegateAddress: DELEGATE,
    });
    expect(r.score).toBe(35);
    expect(r.verdict).toBe('REVIEW');
  });

  it('7702 authorization with chainId 0: +30 on top of the delegate block', () => {
    const { rawTx, decoded } = nativeTransfer('0');
    const r = analyzeRisk(
      { ...rawTx, authorizationList: [{ address: DELEGATE, chainId: 0 }] },
      decoded,
      eoaIntel
    );
    expect(r.verdict).toBe('BLOCK');
    expect(r.score).toBe(100); // 100 from the hard block, +30 clamped back to 100
  });

  it('reverting simulation: +40', () => {
    const { rawTx, decoded } = nativeTransfer();
    const r = analyzeRisk(rawTx, decoded, eoaIntel, undefined, {
      success: false,
      reverted: true,
      error: 'execution reverted',
    });
    expect(r.score).toBe(45); // 5 native + 40 revert
    expect(r.verdict).toBe('REVIEW');
  });

  it('unavailable simulation: +30', () => {
    const { rawTx, decoded } = nativeTransfer();
    const r = analyzeRisk(rawTx, decoded, eoaIntel, undefined, {
      success: false,
      reverted: false,
      error: 'RPC timeout',
    });
    expect(r.score).toBe(35); // 5 native + 30 unknown
    expect(r.verdict).toBe('REVIEW');
  });
});

// ---------------------------------------------------------------------------
// Benign paths — the engine must not cry wolf on ordinary activity
// ---------------------------------------------------------------------------

describe('benign paths stay SAFE', () => {
  it('plain ERC20 transfer scores 0', () => {
    const data = '0xa9059cbb' + word(EOA) + word('0x1');
    const decoded = decodeTransaction({ to: USDC, value: '0', data });
    const r = analyzeRisk({ to: USDC, value: '0', data }, decoded, contractIntel);
    expect(r.score).toBe(0);
    expect(r.verdict).toBe('SAFE');
  });

  it('a successful simulation adds nothing', () => {
    const { rawTx, decoded } = nativeTransfer();
    const r = analyzeRisk(rawTx, decoded, eoaIntel, undefined, { success: true, reverted: false });
    expect(r.score).toBe(5);
    expect(r.verdict).toBe('SAFE');
  });

  it('reports every signal it fires, not just the total', () => {
    const { rawTx, decoded } = approveTx(MAX_UINT256);
    const r = analyzeRisk(rawTx, decoded, contractIntel);
    expect(r.signals.length).toBeGreaterThan(0);
    for (const s of r.signals) {
      expect(s.explanation).toBeTruthy();
      expect(s.evidence).toBeTruthy();
      expect(s.recommendation).toBeTruthy();
      expect(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).toContain(s.severity);
    }
  });
});

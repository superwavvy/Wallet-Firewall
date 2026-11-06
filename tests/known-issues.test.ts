/**
 * KNOWN ISSUES — written with it.fails so the suite stays green while the bugs
 * are real. When a bug is fixed, the corresponding test starts failing ("passed
 * unexpectedly"), which is the signal to delete the it.fails wrapper.
 */
import { describe, expect, it } from 'vitest';
import { analyzeRisk } from '../lib/risk-engine';
import { decodeTransaction } from '../lib/decoder';

const USDC = '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238';
const word = (hex: string) => hex.replace(/^0x/, '').toLowerCase().padStart(64, '0');

const contractIntel = {
  address: USDC,
  isContract: true,
  isDelegated: false,
  delegateAddress: null,
  bytecodeSize: 4096,
  balance: '0',
  nonce: 1,
};

describe('known issues', () => {
  it('BUG 1: decodes uppercase hex calldata (selector lookup has no toLowerCase)', () => {
    const data = '0xA9059CBB' + word('0x0');
    // selectors are stored lowercase, and tx.data is never normalised
    expect(decodeTransaction({ to: USDC, value: '0', data }).type).toBe('CONTRACT_CALL');
  });

  it('BUG 2: scores Permit2 approve as risky (decodes to approve(), but no signal matches)', () => {
    // 0x87517c45 -> 'approve(address,address,uint160,uint48)'
    const data = '0x87517c45' + word(USDC) + word(USDC) + word('0x1') + word('0x1');
    const decoded = decodeTransaction({ to: USDC, value: '0', data });
    expect(decoded.functionName).toContain('approve');
    const r = analyzeRisk({ to: USDC, value: '0', data }, decoded, contractIntel);
    expect(r.verdict).not.toBe('SAFE');
  });

  it('BUG 3: does not throw when rawTx.value is missing (unguarded BigInt())', () => {
    const decoded = decodeTransaction({ to: USDC, value: '0', data: '0x' });
    expect(() =>
      analyzeRisk({ to: USDC, data: '0x' } as any, decoded, contractIntel)
    ).not.toThrow();
  });
});

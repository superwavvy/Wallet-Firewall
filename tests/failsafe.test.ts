/**
 * FAIL-SAFE CONTRACT
 *
 * README claims: "Fail-safe, never fail-open: if the analyzer crashes, it does NOT
 * report 'safe'." In practice an uninspectable target scores 30 -> REVIEW, and the
 * sign button is only disabled on BLOCK, so the user can still sign.
 *
 * These tests encode the agreed behaviour: no inspection -> BLOCK.
 * They fail against the current engine on purpose. Apply patches/fail-closed.md
 * to turn this file green.
 */
import { describe, expect, it } from 'vitest';
import { analyzeRisk } from '../lib/risk-engine';
import { decodeTransaction } from '../lib/decoder';

const EOA = '0x1521F7e625A2c7015981C9179744dBa823d85B37';

const benign = () => {
  const rawTx = { to: EOA, value: '0', data: '0x' };
  return { rawTx, decoded: decodeTransaction(rawTx) };
};

describe('fail-safe: an uninspected target must never be signable', () => {
  it('BLOCKS when intel is null (invalid or unresolvable address)', () => {
    const { rawTx, decoded } = benign();
    const r = analyzeRisk(rawTx, decoded, null);
    expect(r.verdict).toBe('BLOCK');
  });

  it('BLOCKS when intel carries an error payload', () => {
    const { rawTx, decoded } = benign();
    const r = analyzeRisk(rawTx, decoded, { error: 'Failed to fetch contract data' });
    expect(r.verdict).toBe('BLOCK');
  });

  it('BLOCKS when intel is undefined (analyzer crashed before producing intel)', () => {
    const { rawTx, decoded } = benign();
    const r = analyzeRisk(rawTx, decoded, undefined);
    expect(r.verdict).toBe('BLOCK');
  });

  it('never returns SAFE when the target could not be inspected', () => {
    const { rawTx, decoded } = benign();
    for (const intel of [null, undefined, { error: 'x' }]) {
      expect(analyzeRisk(rawTx, decoded, intel).verdict).not.toBe('SAFE');
    }
  });
});

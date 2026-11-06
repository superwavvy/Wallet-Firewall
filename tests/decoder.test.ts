import { describe, expect, it } from 'vitest';
import { decodeTransaction } from '../lib/decoder';

const TO = '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238';

/** Build a tx object in the shape decodeTransaction expects. */
const tx = (data: string, value = '0') => ({ to: TO, value, data });

/** 32-byte ABI word from a hex string. */
const word = (hex: string) => hex.replace(/^0x/, '').toLowerCase().padStart(64, '0');

describe('decodeTransaction — calldata classification', () => {
  it('treats empty calldata as a native transfer', () => {
    expect(decodeTransaction(tx('')).type).toBe('NATIVE_TRANSFER');
    expect(decodeTransaction(tx('0x')).type).toBe('NATIVE_TRANSFER');
  });

  it('treats truncated calldata (under one selector) as a native transfer', () => {
    expect(decodeTransaction(tx('0x1234')).type).toBe('NATIVE_TRANSFER');
    expect(decodeTransaction(tx('0x1234567')).type).toBe('NATIVE_TRANSFER');
  });

  it('treats a bare selector as a contract call, not a native transfer', () => {
    const d = decodeTransaction(tx('0xa9059cbb'));
    expect(d.type).toBe('CONTRACT_CALL');
  });
});

describe('decodeTransaction — known selectors', () => {
  const cases: Array<[string, string, string]> = [
    ['ERC20 transfer', '0xa9059cbb', 'transfer(address,uint256)'],
    ['ERC20 approve', '0x095ea7b3', 'approve(address,uint256)'],
    ['ERC20 transferFrom', '0x23b872dd', 'transferFrom(address,address,uint256)'],
    ['Multicall (bytes[])', '0xac9650d8', 'multicall(bytes[])'],
    ['Multicall (bytes32[])', '0x252dba42', 'multicall(bytes32[])'],
    ['EIP-2612 permit', '0xd505accf', 'permit'],
    ['Permit2 approve', '0x87517c45', 'approve(address,address,uint160,uint48)'],
    ['Permit2 permit', '0x2b67b570', 'permit'],
  ];

  for (const [label, selector, expected] of cases) {
    it(`decodes ${label}`, () => {
      const d = decodeTransaction(tx(selector + word('0x0')));
      expect(d.type).toBe('CONTRACT_CALL');
      expect(d.selector).toBe(selector);
      expect(d.functionName).toContain(expected);
    });
  }
});

describe('decodeTransaction — unknown selectors', () => {
  it('flags an unrecognised selector rather than guessing', () => {
    const d = decodeTransaction(tx('0xdeadbeef' + word('0x0')));
    expect(d.type).toBe('UNKNOWN_SELECTOR');
    expect(d.selector).toBe('0xdeadbeef');
    expect(d.functionName).toBeUndefined();
  });

  it('keeps the raw calldata on both paths', () => {
    const data = '0xdeadbeef' + word('0x0');
    expect(decodeTransaction(tx(data)).rawData).toBe(data);
    expect(decodeTransaction(tx('0xa9059cbb' + word('0x0'))).rawData).toContain('0xa9059cbb');
  });
});

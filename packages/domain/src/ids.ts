// Record IDs: opaque text, globally unique, sortable by creation time
// (docs/specs/architecture.md §4). ULID format: 48-bit millisecond time, then 80 random
// bits, in Crockford base32 (26 characters).

// Web Crypto, present in browsers and Node; typed here so the package needs no DOM or Node types.
const webCrypto = (globalThis as unknown as { crypto: { getRandomValues(a: Uint8Array): Uint8Array } }).crypto;

const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

export function newId(now: number = Date.now()): string {
  if (!Number.isSafeInteger(now) || now < 0 || now >= 2 ** 48) {
    throw new RangeError(`newId: time out of range: ${now}`);
  }
  let time = '';
  let t = now;
  for (let i = 0; i < 10; i++) {
    time = ALPHABET[t % 32] + time;
    t = Math.floor(t / 32);
  }
  const bytes = new Uint8Array(10);
  webCrypto.getRandomValues(bytes);
  let rand = '';
  let acc = 0;
  let bits = 0;
  for (const b of bytes) {
    acc = (acc << 8) | b;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      rand += ALPHABET[(acc >> bits) & 31];
    }
  }
  return time + rand;
}

const ID_PATTERN = /^[0-9A-HJKMNP-TV-Z]{26}$/;

export function isId(value: string): boolean {
  return ID_PATTERN.test(value);
}

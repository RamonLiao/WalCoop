export const MIST_PER_SUI = 1_000_000_000n;

export function toSui(mist: bigint, dp = 2): string {
  const whole = mist / MIST_PER_SUI;
  const frac = mist % MIST_PER_SUI;
  const fracStr = (Number(frac) / Number(MIST_PER_SUI)).toFixed(dp).slice(2);
  return `${whole}.${fracStr}`;
}

export function suiToMist(sui: string): bigint {
  const [w, f = ''] = sui.trim().split('.');
  const frac = (f + '0'.repeat(9)).slice(0, 9);
  return BigInt(w || '0') * MIST_PER_SUI + BigInt(frac || '0');
}

export function short(addr: string, n = 4): string {
  if (!addr || addr.length < 2 * n + 2) return addr;
  return `${addr.slice(0, n + 2)}…${addr.slice(-n)}`;
}

export const enc = (s: string): Uint8Array => new TextEncoder().encode(s);
export const dec = (b: Uint8Array): string => new TextDecoder().decode(b);

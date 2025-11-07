export function fromDecimal128(dec) {
  if (dec === null || dec === undefined) return 0;
  return Number(dec.toString());
}

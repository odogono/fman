// Keep the representation: the ROM's integer shortcuts and floating-point
// operations can give different results for the same mathematical value.
export type SpectrumNumber = readonly [number, number, number, number, number];

const zero = (): SpectrumNumber => [0, 0, 0, 0, 0];
const overflow = (): never => {
  throw new RangeError('Arithmetic overflow');
};

const integer = (value: number): SpectrumNumber => [
  0,
  value < 0 ? 255 : 0,
  value & 255,
  (value >> 8) & 255,
  0
];

const pack = (
  exponent: number,
  mantissa: number,
  negative: boolean
): SpectrumNumber => {
  if (mantissa === 0) {
    return zero();
  }
  while (mantissa < 2 ** 31) {
    mantissa *= 2;
    exponent--;
  }
  if (exponent < 1) {
    // The ROM rounds the half-minimum interval up to its smallest number.
    return exponent === 0 ? [1, negative ? 128 : 0, 0, 0, 0] : zero();
  }
  if (exponent > 255) {
    return overflow();
  }
  return [
    exponent,
    (Math.floor(mantissa / 2 ** 24) & 127) | (negative ? 128 : 0),
    Math.floor(mantissa / 65_536) & 255,
    Math.floor(mantissa / 256) & 255,
    mantissa & 255
  ];
};

const floating = (value: number): SpectrumNumber => {
  if (value === 0) {
    return zero();
  }
  let exponent = Math.floor(Math.log2(Math.abs(value)));
  let mantissa = Math.floor(Math.abs(value) * 2 ** (31 - exponent) + 0.5);
  if (mantissa === 2 ** 32) {
    mantissa /= 2;
    exponent++;
  }
  return pack(exponent + 129, mantissa, value < 0);
};

// This quantizes a host value; it does not implement BASIC's decimal parser.
// Original BASIC constants should be loaded from their stored five bytes.
export const fromNumber = (value: number): SpectrumNumber => {
  if (!Number.isFinite(value)) {
    return overflow();
  }
  if (Number.isInteger(value) && Math.abs(value) <= 65_535) {
    return integer(value);
  }
  return floating(value);
};

export const toNumber = ([
  exponent,
  sign,
  high,
  middle,
  low
]: SpectrumNumber): number => {
  if (exponent === 0) {
    return high + middle * 256 - (sign ? 65_536 : 0);
  }
  const mantissa = (sign | 128) * 2 ** 24 + high * 65_536 + middle * 256 + low;
  return (sign & 128 ? -1 : 1) * mantissa * 2 ** (exponent - 160);
};

const parts = (value: SpectrumNumber) => {
  // Re-stacking the ROM's malformed negative zero discards its sign.
  const small = value[2] === 0 && value[3] === 0 ? 0 : toNumber(value);
  const bytes = value[0] === 0 ? floating(small) : value;
  return {
    exponent: bytes[0],
    mantissa:
      bytes[0] === 0
        ? 0
        : (bytes[1] | 128) * 2 ** 24 +
          bytes[2] * 65_536 +
          bytes[3] * 256 +
          bytes[4],
    negative: Boolean(bytes[1] & 128)
  };
};

const shift = (mantissa: number, places: number) =>
  places > 32 ? 0 : Math.floor(mantissa / 2 ** places + 0.5);

export const add = (
  left: SpectrumNumber,
  right: SpectrumNumber
): SpectrumNumber => {
  if (left[0] === 0 && right[0] === 0) {
    const sum = toNumber(left) + toNumber(right);
    // Preserve the ROM's malformed -65536 small-integer result.
    if (sum >= -65_536 && sum <= 65_535) {
      return integer(sum);
    }
  }
  const a = parts(left);
  const b = parts(right);
  const exponent = Math.max(a.exponent, b.exponent);
  const signedA = a.mantissa * (a.negative ? -1 : 1);
  const signedB = b.mantissa * (b.negative ? -1 : 1);
  let sum =
    shift(signedA, exponent - a.exponent) +
    shift(signedB, exponent - b.exponent);
  if (Math.abs(sum) >= 2 ** 32) {
    sum = shift(sum, 1);
    return pack(exponent + 1, Math.abs(sum), sum < 0);
  }
  return pack(exponent, Math.abs(sum), sum < 0);
};

export const subtract = (
  left: SpectrumNumber,
  right: SpectrumNumber
): SpectrumNumber => {
  const negative: SpectrumNumber =
    right[0] === 0
      ? fromNumber(right[2] === 0 && right[3] === 0 ? 0 : -toNumber(right))
      : [right[0], right[1] ^ 128, right[2], right[3], right[4]];
  return add(left, negative);
};

export const multiply = (
  left: SpectrumNumber,
  right: SpectrumNumber
): SpectrumNumber => {
  if (left[0] === 0 && right[0] === 0) {
    const a = left[2] === 0 && left[3] === 0 ? 0 : toNumber(left);
    const b = right[2] === 0 && right[3] === 0 ? 0 : toNumber(right);
    const result = a * b;
    if (Math.abs(result) <= 65_535) {
      return integer(result);
    }
  }
  const a = parts(left);
  const b = parts(right);
  if (!a.mantissa || !b.mantissa) {
    return zero();
  }
  const product = BigInt(a.mantissa) * BigInt(b.mantissa);
  const places = product >= 1n << 63n ? 32n : 31n;
  let mantissa = Number((product + (1n << (places - 1n))) >> places);
  let exponent = a.exponent + b.exponent - 160 + Number(places);
  if (mantissa === 2 ** 32) {
    mantissa /= 2;
    exponent++;
  }
  return pack(exponent, mantissa, a.negative !== b.negative);
};

export const divide = (
  left: SpectrumNumber,
  right: SpectrumNumber
): SpectrumNumber => {
  const a = parts(left);
  const b = parts(right);
  if (!b.mantissa) {
    return overflow();
  }
  if (!a.mantissa) {
    return zero();
  }
  const quotient = (BigInt(a.mantissa) << 32n) / BigInt(b.mantissa);
  const normal = a.mantissa >= b.mantissa;
  // The ROM's 34th-bit jump is wrong: when normalization needs a left
  // shift, division truncates rather than rounding (notably 1/10).
  let mantissa = Number(normal ? (quotient + 1n) >> 1n : quotient);
  let exponent = a.exponent - b.exponent + (normal ? 129 : 128);
  if (mantissa === 2 ** 32) {
    mantissa /= 2;
    exponent++;
  }
  return pack(exponent, mantissa, a.negative !== b.negative);
};

export const floor = (value: SpectrumNumber): SpectrumNumber => {
  if (value[0] === 0) {
    // INT takes a different path for the ROM's malformed negative zero.
    return value[1] === 255 && value[2] === 0 && value[3] === 0
      ? floating(-1)
      : value;
  }
  const result = Math.floor(toNumber(value));
  return result >= -65_536 && result <= 65_535
    ? integer(result)
    : floating(result);
};

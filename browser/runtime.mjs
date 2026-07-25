export const SAMPLE_RATE = 24000;

function mulberry32(seed) {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function seededNormalNoise(seed, channels, frames) {
  const random = mulberry32(seed);
  const output = new Float32Array(channels * frames);
  for (let index = 0; index < output.length; index += 2) {
    const radius = Math.sqrt(-2 * Math.log(Math.max(random(), Number.MIN_VALUE)));
    const angle = 2 * Math.PI * random();
    output[index] = radius * Math.cos(angle);
    if (index + 1 < output.length) output[index + 1] = radius * Math.sin(angle);
  }
  return output;
}

export function encodeFloat32Wav(samples, sampleRate = SAMPLE_RATE) {
  const buffer = new ArrayBuffer(44 + samples.length * 4);
  const view = new DataView(buffer);
  view.setUint32(0, 0x52494646, false);
  view.setUint32(4, 36 + samples.length * 4, true);
  view.setUint32(8, 0x57415645, false);
  view.setUint32(12, 0x666d7420, false);
  view.setUint32(16, 16, true);
  view.setUint16(20, 3, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 4, true);
  view.setUint16(32, 4, true);
  view.setUint16(34, 32, true);
  view.setUint32(36, 0x64617461, false);
  view.setUint32(40, samples.length * 4, true);
  new Float32Array(buffer, 44).set(samples);
  return buffer;
}

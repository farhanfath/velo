/**
 * Cryptographically secure password, PIN, and passphrase generator for Velo.
 * Uses window.crypto / Web Crypto API.
 */

const UPPERCASE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ"; // exclude ambiguous I, O
const LOWERCASE_CHARS = "abcdefghijkmnopqrstuvwxyz"; // exclude ambiguous l
const DIGIT_CHARS = "23456789"; // exclude ambiguous 0, 1
const SYMBOL_CHARS = "!@#$%^&*-_+=";

const PASSPHRASE_WORDLIST = [
  "anchor", "beacon", "breeze", "bridge", "canyon", "castle", "cedar", "cipher",
  "clover", "cobalt", "comet", "copper", "cosmic", "crater", "crystal", "delta",
  "desert", "dolphin", "dragon", "eagle", "ember", "falcon", "feather", "forest",
  "fossil", "galaxy", "glacier", "granite", "harbor", "haven", "hawk", "horizon",
  "island", "jaguar", "jungle", "lagoon", "lantern", "legend", "lotus", "lunar",
  "magnet", "marble", "matrix", "meadow", "meteor", "mirage", "monarch", "mosaic",
  "nebula", "nexus", "oasis", "ocean", "orbit", "orchid", "panther", "pebble",
  "phoenix", "pillar", "planet", "plasma", "prism", "pulse", "pyramid", "quartz",
  "radar", "radius", "raven", "reef", "ripple", "rover", "saffron", "sailor",
  "sapphire", "shadow", "shield", "sierra", "silver", "solstice", "spark", "sphinx",
  "spiral", "summit", "taiga", "talisman", "temple", "timber", "titan", "topaz",
  "torch", "tropic", "tunnel", "valley", "velvet", "vessel", "vortex", "voyage",
  "willow", "zenith", "zephyr"
];

function getRandomInt(max: number): number {
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  return array[0] % max;
}

export interface PasswordGeneratorOptions {
  length?: number;
  uppercase?: boolean;
  lowercase?: boolean;
  numbers?: boolean;
  symbols?: boolean;
}

export function generatePassword(options: PasswordGeneratorOptions = {}): string {
  const {
    length = 20,
    uppercase = true,
    lowercase = true,
    numbers = true,
    symbols = true,
  } = options;

  let pool = "";
  const guaranteed: string[] = [];

  if (uppercase) {
    pool += UPPERCASE_CHARS;
    guaranteed.push(UPPERCASE_CHARS[getRandomInt(UPPERCASE_CHARS.length)]);
  }
  if (lowercase) {
    pool += LOWERCASE_CHARS;
    guaranteed.push(LOWERCASE_CHARS[getRandomInt(LOWERCASE_CHARS.length)]);
  }
  if (numbers) {
    pool += DIGIT_CHARS;
    guaranteed.push(DIGIT_CHARS[getRandomInt(DIGIT_CHARS.length)]);
  }
  if (symbols) {
    pool += SYMBOL_CHARS;
    guaranteed.push(SYMBOL_CHARS[getRandomInt(SYMBOL_CHARS.length)]);
  }

  if (pool.length === 0) {
    pool = LOWERCASE_CHARS + DIGIT_CHARS;
  }

  const result: string[] = [...guaranteed];
  while (result.length < length) {
    result.push(pool[getRandomInt(pool.length)]);
  }

  // Fisher-Yates shuffle
  for (let i = result.length - 1; i > 0; i--) {
    const j = getRandomInt(i + 1);
    const temp = result[i];
    result[i] = result[j];
    result[j] = temp;
  }

  return result.join("");
}

export function generatePassphrase(wordCount = 4, separator = "-"): string {
  const words: string[] = [];
  for (let i = 0; i < wordCount; i++) {
    words.push(PASSPHRASE_WORDLIST[getRandomInt(PASSPHRASE_WORDLIST.length)]);
  }
  return words.join(separator);
}

export function generatePin(length = 6): string {
  const digits: string[] = [];
  for (let i = 0; i < length; i++) {
    digits.push(getRandomInt(10).toString());
  }
  return digits.join("");
}

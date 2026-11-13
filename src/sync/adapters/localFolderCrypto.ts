export const LOCAL_FOLDER_ENVELOPE_FORMAT = 'daymark-local-folder';
export const LOCAL_FOLDER_ENVELOPE_VERSION = 1;

const PBKDF2_ITERATIONS = 210_000;
const SALT_BYTES = 16;
const IV_BYTES = 12;

export interface LocalFolderEnvelope {
  format: typeof LOCAL_FOLDER_ENVELOPE_FORMAT;
  version: number;
  kdf: { algorithm: 'PBKDF2'; hash: 'SHA-256'; iterations: number; salt: string };
  cipher: { algorithm: 'AES-GCM'; iv: string };
  data: string;
}

function getSubtle(): SubtleCrypto {
  const cryptoApi = globalThis.crypto;
  if (!cryptoApi || !cryptoApi.subtle) {
    throw new Error('Web Crypto API is unavailable in this environment.');
  }
  return cryptoApi.subtle;
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function deriveKey(passphrase: string, salt: Uint8Array, iterations: number): Promise<CryptoKey> {
  const subtle = getSubtle();
  const baseKey = await subtle.importKey(
    'raw',
    new TextEncoder().encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function encryptText(passphrase: string, plaintext: string): Promise<string> {
  if (!passphrase) {
    throw new Error('A passphrase is required to encrypt the local folder backup.');
  }
  const cryptoApi = globalThis.crypto;
  const subtle = getSubtle();
  const salt = cryptoApi.getRandomValues(new Uint8Array(SALT_BYTES));
  const iv = cryptoApi.getRandomValues(new Uint8Array(IV_BYTES));
  const key = await deriveKey(passphrase, salt, PBKDF2_ITERATIONS);
  const encrypted = await subtle.encrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    key,
    new TextEncoder().encode(plaintext),
  );
  const envelope: LocalFolderEnvelope = {
    format: LOCAL_FOLDER_ENVELOPE_FORMAT,
    version: LOCAL_FOLDER_ENVELOPE_VERSION,
    kdf: { algorithm: 'PBKDF2', hash: 'SHA-256', iterations: PBKDF2_ITERATIONS, salt: toBase64(salt) },
    cipher: { algorithm: 'AES-GCM', iv: toBase64(iv) },
    data: toBase64(new Uint8Array(encrypted)),
  };
  return JSON.stringify(envelope);
}

export async function decryptText(passphrase: string, envelopeJson: string): Promise<string> {
  let envelope: LocalFolderEnvelope;
  try {
    envelope = JSON.parse(envelopeJson) as LocalFolderEnvelope;
  } catch {
    throw new Error('The local folder file is not valid JSON.');
  }
  if (
    !envelope || envelope.format !== LOCAL_FOLDER_ENVELOPE_FORMAT ||
    envelope.version !== LOCAL_FOLDER_ENVELOPE_VERSION ||
    envelope.kdf?.algorithm !== 'PBKDF2' || envelope.kdf?.hash !== 'SHA-256' ||
    typeof envelope.kdf?.iterations !== 'number' || typeof envelope.kdf?.salt !== 'string' ||
    envelope.cipher?.algorithm !== 'AES-GCM' || typeof envelope.cipher?.iv !== 'string' ||
    typeof envelope.data !== 'string'
  ) {
    throw new Error('The local folder file is not a supported Daymark encrypted backup.');
  }
  const subtle = getSubtle();
  const key = await deriveKey(passphrase, fromBase64(envelope.kdf.salt), envelope.kdf.iterations);
  try {
    const decrypted = await subtle.decrypt(
      { name: 'AES-GCM', iv: fromBase64(envelope.cipher.iv) as BufferSource },
      key,
      fromBase64(envelope.data) as BufferSource,
    );
    return new TextDecoder().decode(decrypted);
  } catch {
    throw new Error('Could not decrypt the local folder backup. The passphrase is wrong or the file is corrupted.');
  }
}

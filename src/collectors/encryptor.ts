const MAGIC = [0x42, 0x4a, 0x45, 0x31];

function base64ToUint8Array(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export async function encryptForServer(
  payload: Uint8Array,
  serverPublicKeyBase64: string,
): Promise<Blob> {
  const sodiumModule = await import("libsodium-wrappers");
  const sodium = sodiumModule.default ?? sodiumModule;
  await sodium.ready;

  const serverPublicKey = base64ToUint8Array(serverPublicKeyBase64);

  const symmetricKey = sodium.randombytes_buf(
    sodium.crypto_secretbox_KEYBYTES,
  );
  const nonce = sodium.randombytes_buf(sodium.crypto_secretbox_NONCEBYTES);
  const ciphertext = sodium.crypto_secretbox_easy(payload, nonce, symmetricKey);
  const sealedKey = sodium.crypto_box_seal(symmetricKey, serverPublicKey);

  const header = new Uint8Array(MAGIC.length + 1);
  header.set(MAGIC, 0);
  header[MAGIC.length] = 1;

  const sealedKeyLength = new Uint8Array(4);
  new DataView(sealedKeyLength.buffer).setUint32(0, sealedKey.length, true);

  const envelope = new Blob(
    [
      header.buffer as ArrayBuffer,
      nonce.buffer as ArrayBuffer,
      sealedKeyLength.buffer as ArrayBuffer,
      sealedKey.buffer as ArrayBuffer,
      ciphertext.buffer as ArrayBuffer,
    ],
    { type: "application/octet-stream" },
  );

  return envelope;
}

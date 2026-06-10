type SodiumLike = Awaited<ReturnType<typeof loadSodium>>;

async function loadSodium() {
  const mod = await import("libsodium-wrappers");
  const sodium = (mod as { default?: unknown }).default ?? mod;
  await (sodium as { ready: Promise<void> }).ready;
  return sodium as typeof import("libsodium-wrappers");
}

function base64ToUint8Array(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

const MAGIC = [0x42, 0x4a, 0x53, 0x31];

export class StreamEncryptor {
  private sodium: SodiumLike | null = null;
  private state: unknown = null;
  private headerEnvelope: Uint8Array | null = null;

  async init(serverPublicKeyBase64: string): Promise<Uint8Array> {
    const sodium = await loadSodium();
    this.sodium = sodium;

    const serverPublicKey = base64ToUint8Array(serverPublicKeyBase64);
    const symmetricKey =
      sodium.crypto_secretstream_xchacha20poly1305_keygen();
    const sealedKey = sodium.crypto_box_seal(symmetricKey, serverPublicKey);

    const { state, header } =
      sodium.crypto_secretstream_xchacha20poly1305_init_push(symmetricKey);
    this.state = state;

    const magic = new Uint8Array(MAGIC);
    const version = new Uint8Array([1]);
    const sealedKeyLen = new Uint8Array(4);
    new DataView(sealedKeyLen.buffer).setUint32(0, sealedKey.length, true);

    const envelope = concat([
      magic,
      version,
      sealedKeyLen,
      sealedKey,
      header,
    ]);
    this.headerEnvelope = envelope;
    return envelope;
  }

  get header(): Uint8Array {
    if (!this.headerEnvelope) {
      throw new Error("StreamEncryptor not initialized");
    }
    return this.headerEnvelope;
  }

  encryptChunk(data: Uint8Array, final = false): Uint8Array {
    if (!this.sodium || !this.state) {
      throw new Error("StreamEncryptor not initialized");
    }
    const tag = final
      ? this.sodium.crypto_secretstream_xchacha20poly1305_TAG_FINAL
      : this.sodium.crypto_secretstream_xchacha20poly1305_TAG_MESSAGE;
    return this.sodium.crypto_secretstream_xchacha20poly1305_push(
      this.state as Parameters<
        typeof this.sodium.crypto_secretstream_xchacha20poly1305_push
      >[0],
      data,
      null,
      tag,
    );
  }
}

function concat(arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((sum, a) => sum + a.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const a of arrays) {
    out.set(a, offset);
    offset += a.length;
  }
  return out;
}

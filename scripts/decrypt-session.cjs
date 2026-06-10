#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");
const { execSync } = require("node:child_process");
const sodium = require("libsodium-wrappers");

const MAGIC = [0x42, 0x4a, 0x53, 0x31];

function usage() {
  console.error(
    `Usage: node scripts/decrypt-session.cjs <token> <out-dir>

Reads the X25519 private key from AWS Secrets Manager (bug-jar/keypair),
fetches the admin download manifest for <token> from the API, downloads all
encrypted chunks, decrypts each per-page stream, and reconstructs:
  <out-dir>/<pageId>/data.jsonl
  <out-dir>/<pageId>/video.webm
  <out-dir>/<pageId>/meta.json

Env:
  BUG_JAR_API        Base URL, e.g. https://api.arvore.com.br/debug-sessions
  BUG_JAR_API_TOKEN  Admin JWT (Bearer) for the download endpoint
  AWS_PROFILE        AWS profile to read the secret (default: arvore-prd)
  AWS_REGION         Secret region (default: sa-east-1)`,
  );
  process.exit(1);
}

function readPrivateKey() {
  const profile = process.env.AWS_PROFILE || "arvore-prd";
  const region = process.env.AWS_REGION || "sa-east-1";
  const raw = execSync(
    `aws secretsmanager get-secret-value --secret-id bug-jar/keypair --query SecretString --output text --profile ${profile} --region ${region}`,
    { encoding: "utf-8" },
  );
  const parsed = JSON.parse(raw);
  if (!parsed.privateKey) throw new Error("privateKey not found in secret");
  return parsed.privateKey;
}

async function fetchManifest(token) {
  const base = process.env.BUG_JAR_API;
  const auth = process.env.BUG_JAR_API_TOKEN;
  if (!base || !auth) throw new Error("BUG_JAR_API and BUG_JAR_API_TOKEN are required");
  const res = await fetch(
    `${base.replace(/\/$/, "")}/${encodeURIComponent(token)}/download`,
    { headers: { Authorization: `Bearer ${auth}` } },
  );
  if (!res.ok) throw new Error(`manifest fetch failed (${res.status})`);
  return res.json();
}

async function downloadBytes(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download failed (${res.status})`);
  return new Uint8Array(await res.arrayBuffer());
}

function parseStreamHeader(firstChunk, sodiumLib, privateKey, publicKey) {
  let offset = 0;
  for (let i = 0; i < MAGIC.length; i++) {
    if (firstChunk[offset + i] !== MAGIC[i]) throw new Error("bad magic");
  }
  offset += MAGIC.length;
  offset += 1; // version
  const sealedKeyLen = new DataView(
    firstChunk.buffer,
    firstChunk.byteOffset + offset,
    4,
  ).getUint32(0, true);
  offset += 4;
  const sealedKey = firstChunk.slice(offset, offset + sealedKeyLen);
  offset += sealedKeyLen;
  const header = firstChunk.slice(
    offset,
    offset + sodiumLib.crypto_secretstream_xchacha20poly1305_HEADERBYTES,
  );
  const symmetricKey = sodiumLib.crypto_box_seal_open(sealedKey, publicKey, privateKey);
  const state = sodiumLib.crypto_secretstream_xchacha20poly1305_init_pull(
    header,
    symmetricKey,
  );
  return { state };
}

function decryptStream(chunks, sodiumLib, privateKey, publicKey) {
  if (chunks.length === 0) return new Uint8Array(0);
  const { state } = parseStreamHeader(chunks[0], sodiumLib, privateKey, publicKey);
  const parts = [];
  for (let i = 1; i < chunks.length; i++) {
    const result = sodiumLib.crypto_secretstream_xchacha20poly1305_pull(state, chunks[i]);
    if (!result) throw new Error(`failed to decrypt chunk ${i}`);
    parts.push(result.message);
  }
  const total = parts.reduce((s, p) => s + p.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const p of parts) {
    out.set(p, off);
    off += p.length;
  }
  return out;
}

async function main() {
  const [token, outDir] = process.argv.slice(2);
  if (!token || !outDir) usage();

  await sodium.ready;
  const privateKeyB64 = readPrivateKey();
  const privateKey = sodium.from_base64(privateKeyB64, sodium.base64_variants.ORIGINAL);
  const publicKey = sodium.crypto_scalarmult_base(privateKey);

  const manifest = await fetchManifest(token);
  console.log(`Manifest: ${manifest.count} objects`);

  const byPage = {};
  for (const obj of manifest.objects) {
    const rel = obj.key.replace(`debug/${token}/`, "");
    const parts = rel.split("/");
    const pageId = parts[0];
    byPage[pageId] = byPage[pageId] || { meta: null, data: [], video: [] };
    if (parts[1] === "meta.json") byPage[pageId].meta = obj;
    else if (parts[1] === "data") byPage[pageId].data.push(obj);
    else if (parts[1] === "video") byPage[pageId].video.push(obj);
  }

  for (const [pageId, group] of Object.entries(byPage)) {
    const dir = path.join(outDir, pageId);
    fs.mkdirSync(dir, { recursive: true });

    if (group.meta) {
      const bytes = await downloadBytes(group.meta.downloadUrl);
      fs.writeFileSync(path.join(dir, "meta.json"), Buffer.from(bytes));
    }

    for (const stream of ["data", "video"]) {
      const objs = group[stream].sort((a, b) => a.key.localeCompare(b.key));
      if (objs.length === 0) continue;
      const chunks = [];
      for (const o of objs) chunks.push(await downloadBytes(o.downloadUrl));
      const decrypted = decryptStream(chunks, sodium, privateKey, publicKey);
      const file = stream === "video" ? "video.webm" : "data.jsonl";
      fs.writeFileSync(path.join(dir, file), Buffer.from(decrypted));
      console.log(`  ${pageId}/${file}: ${decrypted.length} bytes`);
    }
  }

  console.log(`Done. Output in ${outDir}`);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});

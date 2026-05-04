import type { BugReport } from "./types";
import { generateSummary } from "./summary";

export async function exportAsZip(
  report: BugReport,
  videoBlob: Blob | null,
): Promise<Blob> {
  const files: Array<{ name: string; content: Uint8Array }> = [];

  const reportJson = JSON.stringify(report, null, 2);
  files.push({
    name: "report.json",
    content: new TextEncoder().encode(reportJson),
  });

  const summary = generateSummary(report);
  files.push({
    name: "summary.md",
    content: new TextEncoder().encode(summary),
  });

  if (report.screenshot) {
    const screenshotData = dataUrlToUint8Array(report.screenshot);
    if (screenshotData) {
      files.push({ name: "screenshot.png", content: screenshotData });
    }
  }

  if (videoBlob) {
    const videoData = new Uint8Array(await videoBlob.arrayBuffer());
    files.push({ name: "recording.webm", content: videoData });
  }

  return createZip(files);
}

function dataUrlToUint8Array(dataUrl: string): Uint8Array | null {
  try {
    const base64 = dataUrl.split(",")[1];
    if (!base64) return null;
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  } catch {
    return null;
  }
}

function createZip(files: Array<{ name: string; content: Uint8Array }>): Blob {
  const localHeaders: Uint8Array[] = [];
  const centralHeaders: Uint8Array[] = [];
  let offset = 0;

  for (const file of files) {
    const nameBytes = new TextEncoder().encode(file.name);
    const crc = crc32(file.content);
    const localHeader = buildLocalHeader(nameBytes, file.content.length, crc);
    localHeaders.push(localHeader);
    localHeaders.push(nameBytes);
    localHeaders.push(file.content);

    const centralHeader = buildCentralHeader(
      nameBytes,
      file.content.length,
      crc,
      offset,
    );
    centralHeaders.push(centralHeader);
    centralHeaders.push(nameBytes);

    offset += localHeader.length + nameBytes.length + file.content.length;
  }

  const centralDirOffset = offset;
  let centralDirSize = 0;
  for (const ch of centralHeaders) {
    centralDirSize += ch.length;
  }

  const endRecord = buildEndRecord(
    files.length,
    centralDirSize,
    centralDirOffset,
  );

  const parts: ArrayBuffer[] = [
    ...localHeaders,
    ...centralHeaders,
    endRecord,
  ].map((u) => u.buffer as ArrayBuffer);
  return new Blob(parts, { type: "application/zip" });
}

function buildLocalHeader(
  name: Uint8Array,
  size: number,
  crc: number,
): Uint8Array {
  const header = new Uint8Array(30);
  const view = new DataView(header.buffer);
  view.setUint32(0, 0x04034b50, true);
  view.setUint16(4, 20, true);
  view.setUint16(6, 0, true);
  view.setUint16(8, 0, true);
  view.setUint16(10, 0, true);
  view.setUint16(12, 0, true);
  view.setUint32(14, crc, true);
  view.setUint32(18, size, true);
  view.setUint32(22, size, true);
  view.setUint16(26, name.length, true);
  view.setUint16(28, 0, true);
  return header;
}

function buildCentralHeader(
  name: Uint8Array,
  size: number,
  crc: number,
  offset: number,
): Uint8Array {
  const header = new Uint8Array(46);
  const view = new DataView(header.buffer);
  view.setUint32(0, 0x02014b50, true);
  view.setUint16(4, 20, true);
  view.setUint16(6, 20, true);
  view.setUint16(8, 0, true);
  view.setUint16(10, 0, true);
  view.setUint16(12, 0, true);
  view.setUint16(14, 0, true);
  view.setUint32(16, crc, true);
  view.setUint32(20, size, true);
  view.setUint32(24, size, true);
  view.setUint16(28, name.length, true);
  view.setUint16(30, 0, true);
  view.setUint16(32, 0, true);
  view.setUint16(34, 0, true);
  view.setUint16(36, 0, true);
  view.setUint32(38, 0, true);
  view.setUint32(42, offset, true);
  return header;
}

function buildEndRecord(
  count: number,
  centralDirSize: number,
  centralDirOffset: number,
): Uint8Array {
  const record = new Uint8Array(22);
  const view = new DataView(record.buffer);
  view.setUint32(0, 0x06054b50, true);
  view.setUint16(4, 0, true);
  view.setUint16(6, 0, true);
  view.setUint16(8, count, true);
  view.setUint16(10, count, true);
  view.setUint32(12, centralDirSize, true);
  view.setUint32(16, centralDirOffset, true);
  view.setUint16(20, 0, true);
  return record;
}

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    crc ^= data[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

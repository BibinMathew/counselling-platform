export function hasSameOrigin(request: Request) {
  try {
    const value = request.headers.get("origin");
    if (!value) return false;
    const origin = new URL(value);
    const protocol = new URL(request.url).protocol;
    return (
      origin.origin === value &&
      origin.host === request.headers.get("host") &&
      origin.protocol === protocol
    );
  } catch {
    return false;
  }
}
export async function readLimitedBody(request: Request, limit = 65536) {
  if (Number(request.headers.get("content-length")) > limit) throw new Error("Request too large");
  const reader = request.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) {
      await reader.cancel();
      throw new Error("Request too large");
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf8");
}

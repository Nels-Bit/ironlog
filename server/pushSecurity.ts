import { ECDH, timingSafeEqual } from "node:crypto";

export class RequestError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}
export const isUuid = (v: unknown): v is string =>
  typeof v === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    v,
  );
export const safeSecretEqual = (value: string, expected: string) => {
  const a = Buffer.from(value),
    b = Buffer.from(expected);
  return a.length === b.length && b.length > 0 && timingSafeEqual(a, b);
};
export function validatePushSubscription(value: unknown) {
  if (!value || typeof value !== "object")
    throw new RequestError(400, "Invalid subscription.");
  const s = value as {
    endpoint?: unknown;
    keys?: { p256dh?: unknown; auth?: unknown };
  };
  if (typeof s.endpoint !== "string" || s.endpoint.length > 2048)
    throw new RequestError(400, "Invalid push endpoint.");
  let u: URL;
  try {
    u = new URL(s.endpoint);
  } catch {
    throw new RequestError(400, "Invalid push endpoint.");
  }
  // Only known browser push services, never arbitrary URLs/internal network targets.
  const approved =
    u.hostname === "fcm.googleapis.com" ||
    u.hostname.endsWith(".push.apple.com") ||
    u.hostname.endsWith(".push.services.mozilla.com") ||
    u.hostname.endsWith(".notify.windows.com");
  if (
    u.protocol !== "https:" ||
    u.port ||
    u.username ||
    u.password ||
    u.hash ||
    !approved
  )
    throw new RequestError(400, "Unsupported push endpoint.");
  if (
    !s.keys ||
    typeof s.keys.p256dh !== "string" ||
    typeof s.keys.auth !== "string" ||
    !/^[A-Za-z0-9_-]{86,88}$/.test(s.keys.p256dh) ||
    !/^[A-Za-z0-9_-]{22,24}$/.test(s.keys.auth)
  )
    throw new RequestError(400, "Invalid encryption keys.");
  const publicKey = Buffer.from(s.keys.p256dh, "base64url"),
    auth = Buffer.from(s.keys.auth, "base64url");
  if (publicKey.length !== 65 || publicKey[0] !== 4 || auth.length !== 16)
    throw new RequestError(400, "Invalid encryption keys.");
  try {
    ECDH.convertKey(publicKey, "prime256v1");
  } catch {
    throw new RequestError(400, "Invalid public key.");
  }
  return {
    endpoint: s.endpoint,
    keys: { p256dh: s.keys.p256dh, auth: s.keys.auth },
  };
}
export function pushFailureDisposition(
  status: number | undefined,
  attempts: number,
) {
  if (status === 404 || status === 410) return "invalidate";
  if (
    attempts >= 5 ||
    (status &&
      status >= 400 &&
      status < 500 &&
      status !== 408 &&
      status !== 429)
  )
    return "failed";
  return "retry";
}

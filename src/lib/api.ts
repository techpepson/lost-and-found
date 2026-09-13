import { httpsCallable } from "firebase/functions";
import { functions, storage } from "./firebase";
import { getBlob, ref, uploadBytes } from "firebase/storage";
import { useEffect, useState } from "react";
import { Platform } from "react-native";

export function requestId() {
  return Array.from(
    globalThis.crypto.getRandomValues(new Uint8Array(16)),
    (b) => b.toString(16).padStart(2, "0"),
  ).join("");
}
export async function mutate<
  T = {
    ok?: boolean;
    id?: string;
    code?: string;
    expiresAt?: number;
    alreadyIssued?: boolean;
  },
>(action: string, data: Record<string, unknown> = {}): Promise<T> {
  const result = await httpsCallable(
    functions,
    "workflow",
  )({ ...data, action, requestId: requestId() });
  const payload = result.data as T & { ok?: boolean; error?: string };
  if (payload.ok === false)
    throw new Error(payload.error || "The request could not be completed.");
  return payload;
}
export function errorMessage(error: unknown) {
  if (!(error instanceof Error))
    return "Something went wrong. Please try again.";
  const code = (error as { code?: string }).code;
  if (code === "permission-denied" || code === "firestore/permission-denied")
    return "This information is unavailable to your account. Check your email verification or contact an administrator.";
  if (code === "functions/unavailable" || code === "unavailable")
    return "The service is unavailable. Check your connection and try again.";
  if (code === "functions/internal")
    return "The service could not complete this request. Please try again.";
  if (code === "failed-precondition" && error.message.includes("index"))
    return "This view is being prepared. An administrator needs to finish the database setup.";
  if (code?.startsWith("auth/")) {
    if (
      [
        "auth/invalid-credential",
        "auth/wrong-password",
        "auth/user-not-found",
      ].includes(code)
    )
      return "The email or password is incorrect.";
    if (code === "auth/email-already-in-use")
      return "An account already uses this email. Sign in or reset your password.";
    if (code === "auth/too-many-requests")
      return "Too many attempts. Please wait and try again.";
    if (code === "auth/invalid-email") return "Enter a valid email address.";
  }
  return error.message
    .replace(/^Firebase:\s*/, "")
    .replace(/\s*\(auth\/[^)]+\)\.?$/, "");
}
export async function uploadImage(
  uri: string,
  uid: string,
  claimId?: string,
): Promise<string> {
  let blob = await (await fetch(uri)).blob();
  // Re-encode browser uploads to discard EXIF/location metadata and bound image dimensions.
  if (Platform.OS === "web") {
    const bitmap = await createImageBitmap(blob);
    const scale = Math.min(1, 1800 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas
      .getContext("2d")!
      .drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (b) =>
          b ? resolve(b) : reject(new Error("Could not prepare this image.")),
        "image/jpeg",
        0.85,
      ),
    );
  }
  if (
    !["image/jpeg", "image/png", "image/webp"].includes(blob.type) ||
    blob.size >= 4 * 1024 * 1024
  )
    throw new Error("Choose a JPEG, PNG or WebP image smaller than 4 MB.");
  const path =
    (claimId ? "evidence/" + uid + "/" + claimId : "photos/" + uid) +
    "/" +
    requestId();
  await uploadBytes(ref(storage, path), blob, { contentType: blob.type });
  return path;
}
export function useProtectedImage(path?: string) {
  const [uri, setUri] = useState<string>();
  const [error, setError] = useState<string>();
  useEffect(() => {
    setUri(undefined);
    setError(undefined);
    if (!path) return;
    let active = true;
    let objectUrl: string | undefined;
    getBlob(ref(storage, path), 4 * 1024 * 1024)
      .then((blob) => {
        if (!active) return;
        objectUrl = URL.createObjectURL(blob);
        setUri(objectUrl);
      })
      .catch((e) => {
        if (active) setError(errorMessage(e));
      });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [path]);
  return { uri, error };
}

import { httpsCallable } from "firebase/functions";
import { ref, uploadBytes } from "firebase/storage";
import { randomUUID } from "expo-crypto";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { File, Paths } from "expo-file-system";
import { Image, Platform } from "react-native";
import { useEffect, useState } from "react";
import { functions, storage, auth } from "./firebase";

export function requestId() {
  return randomUUID();
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
  if (code === "functions/not-found")
    return "The recovery service is not ready yet. Please contact the project operator.";
  if (["permission-denied", "firestore/permission-denied"].includes(code ?? ""))
    return "This information is unavailable to your account. Check your verification or contact an administrator.";
  if (
    [
      "functions/unavailable",
      "unavailable",
      "auth/network-request-failed",
    ].includes(code ?? "")
  )
    return "The service is unavailable. Check your connection and try again.";
  if (code === "functions/internal")
    return "The service could not complete this request. Please try again.";
  if (
    [
      "auth/invalid-credential",
      "auth/wrong-password",
      "auth/user-not-found",
    ].includes(code ?? "")
  )
    return "The email or password is incorrect.";
  if (code === "auth/email-already-in-use")
    return "An account already uses this email. Sign in or reset your password.";
  if (code === "auth/too-many-requests")
    return "Too many attempts. Please wait and try again.";
  if (code === "auth/invalid-email") return "Enter a valid email address.";
  if (code === "failed-precondition" && error.message.includes("index"))
    return "This view is being prepared. Please contact the project operator.";
  return error.message
    .replace(/^Firebase:\s*/, "")
    .replace(/\s*\(auth\/[^)]+\)\.?$/, "");
}
export async function uploadImage(
  uri: string,
  uid: string,
  claimId?: string,
): Promise<string> {
  const dimensions = await new Promise<{ width: number; height: number }>(
    (resolve, reject) =>
      Image.getSize(uri, (width, height) => resolve({ width, height }), reject),
  );
  const context = ImageManipulator.manipulate(uri);
  const scale = Math.min(
    1,
    1800 / Math.max(dimensions.width, dimensions.height),
  );
  context.resize({
    width: Math.round(dimensions.width * scale),
    height: Math.round(dimensions.height * scale),
  });
  const rendered = await context.renderAsync();
  const result = await rendered.saveAsync({
    compress: 0.85,
    format: SaveFormat.JPEG,
  });
  const image = new File(result.uri);
  try {
    if (image.size >= 4 * 1024 * 1024)
      throw new Error(
        "Choose a smaller image. Photos must be smaller than 4 MB.",
      );
    const path =
      (claimId ? "evidence/" + uid + "/" + claimId : "photos/" + uid) +
      "/" +
      requestId();
    await uploadBytes(ref(storage, path), await image.bytes(), {
      contentType: "image/jpeg",
    });
    return path;
  } finally {
    if (image.exists) image.delete();
  }
}
export function useProtectedImage(path?: string) {
  const [uri, setUri] = useState<string>();
  const [error, setError] = useState<string>();
  useEffect(() => {
    setUri(undefined);
    setError(undefined);
    if (!path) return;
    let active = true;
    const destination = new File(
      Paths.cache,
      "recovery-" + requestId() + ".jpg",
    );
    const clean = () => {
      try {
        if (destination.exists) destination.delete();
      } catch {
        /* Cache cleanup is best effort. */
      }
    };
    async function load() {
      if (!auth.currentUser) throw new Error("Sign in to view this photo.");
      const token = await auth.currentUser.getIdToken();
      const bucket = storage.app.options.storageBucket;
      const host =
        process.env.EXPO_PUBLIC_EMULATOR_HOST ||
        (Platform.OS === "android" ? "10.0.2.2" : "127.0.0.1");
      const origin =
        process.env.EXPO_PUBLIC_USE_EMULATORS === "true"
          ? "http://" + host + ":9199"
          : "https://firebasestorage.googleapis.com";
      const url =
        origin +
        "/v0/b/" +
        encodeURIComponent(bucket ?? "") +
        "/o/" +
        encodeURIComponent(path!) +
        "?alt=media";
      const file = await File.downloadFileAsync(url, destination, {
        headers: { Authorization: "Firebase " + token },
      });
      if (!active) {
        clean();
        return;
      }
      if (file.size > 4 * 1024 * 1024) {
        clean();
        throw new Error("This image exceeds the permitted size.");
      }
      setUri(file.uri);
    }
    void load().catch((e) => {
      clean();
      if (active) setError(errorMessage(e));
    });
    return () => {
      active = false;
      clean();
    };
  }, [path]);
  return { uri, error };
}

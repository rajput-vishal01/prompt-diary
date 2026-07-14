"use client";

import { api } from "./client-api";

const MAX_BYTES = 5 * 1024 * 1024;

interface SignResponse {
  cloudName: string;
  apiKey: string;
  timestamp: number;
  folder: string;
  signature: string;
}

/** Direct-to-Cloudinary signed upload. Returns the hosted image URL. */
export async function uploadImage(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("Only images can be uploaded");
  if (file.size > MAX_BYTES) throw new Error("Image must be under 5MB");

  const sign = await api<SignResponse>("/api/v1/uploads/sign", { method: "POST" });

  const form = new FormData();
  form.append("file", file);
  form.append("api_key", sign.apiKey);
  form.append("timestamp", String(sign.timestamp));
  form.append("folder", sign.folder);
  form.append("signature", sign.signature);

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${sign.cloudName}/image/upload`,
    { method: "POST", body: form },
  );
  const json = (await res.json().catch(() => null)) as {
    secure_url?: string;
    error?: { message?: string };
  } | null;
  if (!res.ok || !json?.secure_url) {
    throw new Error(json?.error?.message ?? "Upload failed");
  }
  return json.secure_url;
}

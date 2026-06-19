"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  APP_SESSION_COOKIE,
  createSessionToken,
  isCorrectPassword,
} from "@/lib/app-auth/session";

export async function login(
  _prevState: { error?: string } | undefined,
  formData: FormData,
): Promise<{ error?: string }> {
  const password = String(formData.get("password") ?? "");
  if (!isCorrectPassword(password)) {
    return { error: "Falsches Passwort." };
  }
  const token = await createSessionToken();
  const cookieStore = await cookies();
  cookieStore.set(APP_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  redirect("/");
}

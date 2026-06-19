"use client";

import { useActionState } from "react";
import { login } from "./actions";

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(login, {});
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <form
        action={formAction}
        className="w-full max-w-sm space-y-4 rounded-xl bg-neutral-800 p-6"
      >
        <h1 className="text-xl font-bold">Anmelden</h1>
        <input
          type="password"
          name="password"
          autoFocus
          placeholder="Passwort"
          className="w-full rounded-lg bg-neutral-700 px-3 py-2 outline-none"
        />
        {state?.error && (
          <p className="text-sm text-red-400">{state.error}</p>
        )}
        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-lg bg-green-600 px-3 py-2 font-semibold disabled:opacity-50"
        >
          {pending ? "..." : "Weiter"}
        </button>
      </form>
    </main>
  );
}

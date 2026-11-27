"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { runSpotifyTest, type TestRunState } from "./actions";

export function TestRunner() {
  const [state, action, pending] = useActionState<TestRunState | null>(runSpotifyTest, null);

  return (
    <section aria-labelledby="test-title" className="flex flex-col gap-4">
      <h2 id="test-title" className="text-lg font-semibold">
        Test du provider
      </h2>
      <form action={action}>
        <Button type="submit" size="lg" disabled={pending} className="w-full sm:w-auto">
          {pending ? "Test en cours…" : "Lancer le test"}
        </Button>
      </form>

      {/* aria-live : le résultat est annoncé par les lecteurs d'écran quand il arrive. */}
      <div aria-live="polite" className="flex flex-col gap-3">
        {state && (
          <>
            <p className="text-sm text-muted-foreground">
              Exécuté le {new Date(state.ranAt).toLocaleString("fr-FR")}
            </p>
            <ol className="flex flex-col gap-3">
              {state.steps.map((s, i) => (
                <li
                  key={i}
                  className={`rounded-lg border p-3 ${s.ok ? "border-green-600/40" : "border-destructive/60"}`}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded px-2 py-0.5 text-xs font-semibold ${
                        s.ok
                          ? "bg-green-600/15 text-green-800 dark:text-green-300"
                          : "bg-destructive/15 text-destructive"
                      }`}
                    >
                      {s.ok ? "OK" : `ÉCHEC${s.httpStatus ? ` · HTTP ${s.httpStatus}` : ""}`}
                    </span>
                    <span className="font-medium">{s.label}</span>
                  </div>
                  <code className="mt-1 block text-xs break-all text-muted-foreground">
                    {s.request}
                    {s.errorKind ? ` · ${s.errorKind}` : ""}
                  </code>
                  <pre className="mt-2 max-h-80 overflow-auto rounded bg-muted p-2 text-xs">
                    {s.output}
                  </pre>
                </li>
              ))}
            </ol>
          </>
        )}
      </div>
    </section>
  );
}

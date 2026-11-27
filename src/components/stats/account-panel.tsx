"use client";
// Lien entre les stats affichées et le compte : enregistrer un export, ajouter un export
// plus récent, ou supprimer l'historique enregistré.
import { useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { formatInt } from "./format";
import type { UploadState } from "./use-stats";
import type { DataSource } from "./worker-protocol";

interface Props {
  loggedIn: boolean;
  source: DataSource;
  plays: number;
  upload: UploadState;
  onUpload: () => void;
  onShowAccount: () => void;
  onAddExport: () => void;
  onDelete: () => Promise<string | null>;
}

export function AccountPanel(props: Props) {
  const { loggedIn, source, plays, upload } = props;

  if (!loggedIn) {
    return (
      <div className="flex flex-col items-start gap-2 rounded-lg border p-3 text-sm">
        <p>
          Ces stats sont calculées sur ton appareil et ne sont pas enregistrées. Connecte-toi pour
          les garder dans ton compte et les retrouver sur tous tes appareils.
        </p>
        {/* Lien simple : la connexion passe par une redirection serveur. */}
        <a href="/api/auth/spotify/login" className={buttonVariants({ size: "sm" })}>
          Se connecter à Spotify
        </a>
      </div>
    );
  }

  if (source === "account") return <SavedHistory {...props} />;

  return (
    <div className="flex flex-col items-start gap-2 rounded-lg border p-3 text-sm">
      {upload.status === "idle" && (
        <>
          <p>
            Ces stats viennent de ton fichier : rien n&apos;est encore enregistré dans ton compte.
          </p>
          <Button size="sm" onClick={props.onUpload}>
            Enregistrer dans mon compte
          </Button>
        </>
      )}
      {upload.status === "sending" && (
        <>
          <progress
            className="h-2 w-full accent-primary"
            max={upload.total}
            value={upload.sent}
            aria-label="Progression de l'enregistrement"
          />
          <p aria-live="polite" className="text-muted-foreground">
            Enregistrement : {formatInt(upload.sent)} / {formatInt(upload.total)} écoutes…
          </p>
        </>
      )}
      {upload.status === "done" && (
        <>
          <p aria-live="polite">
            ✓ {formatInt(upload.received)} écoutes envoyées, dont{" "}
            <strong>{formatInt(upload.inserted)} nouvelles</strong> enregistrées
            {upload.inserted < upload.received ? " (les autres l'étaient déjà)" : ""}.
          </p>
          <Button size="sm" variant="outline" onClick={props.onShowAccount}>
            Voir mon historique enregistré
          </Button>
        </>
      )}
      {upload.status === "error" && (
        <div role="alert" className="flex flex-col items-start gap-2">
          <p className="font-semibold text-destructive">Enregistrement interrompu</p>
          <p>{upload.message}</p>
          <Button size="sm" onClick={props.onUpload}>
            Réessayer
          </Button>
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        {formatInt(plays)} écoutes. Seuls la date, la durée écoutée et le morceau sont envoyés,
        jamais ton adresse IP ni ton appareil.
      </p>
    </div>
  );
}

function SavedHistory({ plays, onAddExport, onDelete }: Props) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  return (
    <div className="flex flex-col gap-2 rounded-lg border p-3 text-sm">
      <p>
        Historique enregistré dans ton compte : <strong>{formatInt(plays)} écoutes</strong>.
      </p>
      {!confirming ? (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={onAddExport}>
            Ajouter un export plus récent
          </Button>
          <Button size="sm" variant="destructive" onClick={() => setConfirming(true)}>
            Supprimer mes données d&apos;écoute
          </Button>
        </div>
      ) : (
        <div role="alert" className="flex flex-col gap-2 rounded-md bg-destructive/10 p-2">
          <p>
            Supprimer définitivement les {formatInt(plays)} écoutes enregistrées ? Ton export
            Spotify n&apos;est pas touché : tu pourras le réimporter.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="destructive"
              disabled={deleting}
              onClick={async () => {
                setDeleting(true);
                const message = await onDelete();
                setDeleting(false);
                if (message) setError(message);
              }}
            >
              {deleting ? "Suppression…" : "Oui, tout supprimer"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={deleting}
              onClick={() => setConfirming(false)}
            >
              Annuler
            </Button>
          </div>
          {error && <p className="text-destructive">{error}</p>}
        </div>
      )}
    </div>
  );
}

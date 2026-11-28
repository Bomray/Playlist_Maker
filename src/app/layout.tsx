import type { Metadata, Viewport } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import { BottomNav } from "@/components/layout/main-nav";
import { Aurora, SiteHeader } from "@/components/layout/site-header";
import { THEME_SCRIPT } from "@/lib/theme";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const spaceGrotesk = Space_Grotesk({ variable: "--font-space-grotesk", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "Wavl", template: "%s — Wavl" },
  description:
    "Tes stats d'écoute Spotify en détail, et la conversion de playlists entre plateformes.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0a0812" },
    { media: "(prefers-color-scheme: light)", color: "#f7f5fb" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // suppressHydrationWarning : la classe `dark` est posée par le script avant React.
    <html
      lang="fr"
      suppressHydrationWarning
      className={`${inter.variable} ${spaceGrotesk.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="flex min-h-full flex-col">
        <Aurora />
        <SiteHeader />
        {/* Marge du bas sur téléphone : la barre de navigation flottante ne cache rien. */}
        <div className="flex flex-1 flex-col pb-28 md:pb-10">{children}</div>
        <BottomNav />
      </body>
    </html>
  );
}

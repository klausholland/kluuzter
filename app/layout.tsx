import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Hitster",
  description: "Musik-Ratespiel im Hitster-Stil",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="de">
      <body className="min-h-screen bg-neutral-900 text-neutral-100">
        {children}
      </body>
    </html>
  );
}

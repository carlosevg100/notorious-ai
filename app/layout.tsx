import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Notorious AI — O Sistema Operacional do Advogado Brasileiro",
  description: "Legal AI OS for Brazilian law firms",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body style={{ margin: 0, background: '#0A0A0A' }}>{children}</body>
    </html>
  );
}

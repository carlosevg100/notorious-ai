import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "./theme-context";

export const metadata: Metadata = {
  title: "Notorious AI — O Sistema Operacional do Advogado Brasileiro",
  description: "Legal AI OS for Brazilian law firms",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" data-theme="dark">
      <body style={{ margin: 0 }}>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}

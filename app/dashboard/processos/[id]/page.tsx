import { Suspense } from "react";
import ProcessoContent from "./content";

export default function ProcessoPage() {
  return (
    <Suspense fallback={<div style={{ padding: 40, textAlign: "center", color: "var(--text-3)" }}>Carregando...</div>}>
      <ProcessoContent />
    </Suspense>
  );
}

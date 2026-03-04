import { Suspense } from "react";
import NewProcessoContent from "./content";

export default function NewProcessoPage() {
  return (
    <Suspense fallback={<div style={{ padding: 40, textAlign: "center", color: "var(--text-3)" }}>Carregando...</div>}>
      <NewProcessoContent />
    </Suspense>
  );
}

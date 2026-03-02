"use client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
export default function BibliotecaPage() {
  const router = useRouter();
  useEffect(() => { router.replace('/dashboard/documentos'); }, []);
  return null;
}

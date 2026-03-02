"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("cristiano@bluz.adv.br");
  const [pass, setPass] = useState("••••••••");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    await new Promise(r => setTimeout(r, 1200));
    router.push("/dashboard");
  };

  return (
    <div style={{
      minHeight: '100vh', background: '#0A0A0A', display: 'flex',
      alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden'
    }}>
      {/* Background grid */}
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: 'linear-gradient(rgba(201,168,76,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(201,168,76,0.03) 1px, transparent 1px)',
        backgroundSize: '40px 40px'
      }} />
      {/* Glow */}
      <div style={{
        position: 'absolute', top: '30%', left: '50%', transform: 'translateX(-50%)',
        width: '600px', height: '400px',
        background: 'radial-gradient(ellipse, rgba(201,168,76,0.06) 0%, transparent 70%)',
        pointerEvents: 'none'
      }} />

      <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: '420px', padding: '0 24px' }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '48px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', marginBottom: '16px' }}>
            <div style={{
              width: '44px', height: '44px', borderRadius: '10px',
              background: 'linear-gradient(135deg, #C9A84C, #8B6914)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '20px', fontWeight: '800', color: '#000'
            }}>N</div>
            <span style={{ fontSize: '26px', fontWeight: '700', color: '#fff', letterSpacing: '-0.5px' }}>
              Notorious <span style={{ color: '#C9A84C' }}>AI</span>
            </span>
          </div>
          <p style={{ fontSize: '13px', color: '#555', letterSpacing: '0.5px', textTransform: 'uppercase', fontWeight: '500' }}>
            O Sistema Operacional do Advogado Brasileiro
          </p>
        </div>

        {/* Card */}
        <div style={{
          background: '#111', border: '1px solid #1f1f1f', borderRadius: '12px', padding: '36px'
        }}>
          <h2 style={{ margin: '0 0 24px 0', fontSize: '16px', fontWeight: '600', color: '#fff' }}>
            Acesse sua conta
          </h2>

          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', color: '#666', marginBottom: '8px', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                E-mail
              </label>
              <input
                type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="seu@escritorio.adv.br"
              />
            </div>
            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', fontSize: '12px', color: '#666', marginBottom: '8px', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Senha
              </label>
              <input
                type="password" value={pass} onChange={e => setPass(e.target.value)}
                placeholder="••••••••"
              />
              <div style={{ textAlign: 'right', marginTop: '8px' }}>
                <span style={{ fontSize: '12px', color: '#C9A84C', cursor: 'pointer' }}>Esqueci minha senha</span>
              </div>
            </div>
            <button
              type="submit" className="btn-gold" disabled={loading}
              style={{ width: '100%', justifyContent: 'center', padding: '12px', fontSize: '14px' }}
            >
              {loading ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
                  <span style={{ width: '14px', height: '14px', border: '2px solid #00000040', borderTop: '2px solid #000', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite' }} />
                  Entrando...
                </span>
              ) : 'Entrar'}
            </button>
          </form>
        </div>

        <p style={{ textAlign: 'center', marginTop: '24px', fontSize: '12px', color: '#333' }}>
          B/Luz Advogados · Plano Enterprise · 25 usuários
        </p>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

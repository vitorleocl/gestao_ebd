import React, { useState } from 'react';
import { BookOpen, Shield, CheckCircle2, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const LoginScreen: React.FC = () => {
  const { signInWithGoogle, authError } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const handleLogin = async () => {
    try {
      setIsSubmitting(true);
      setLocalError(null);
      await signInWithGoogle();
    } catch (err: unknown) {
      console.error("Falha no login:", err);
      setLocalError(
        err instanceof Error 
          ? err.message 
          : 'Não foi possível completar o login com Google. Tente novamente.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-100 via-slate-50 to-indigo-50/40 flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl shadow-slate-200/70 border border-slate-200 overflow-hidden">
        
        {/* Header Banner */}
        <div className="bg-gradient-to-r from-indigo-700 via-indigo-800 to-slate-900 p-8 text-center text-white relative">
          <div className="w-16 h-16 rounded-2xl bg-white/10 backdrop-blur-md mx-auto flex items-center justify-center mb-4 shadow-inner border border-white/20">
            <BookOpen className="w-8 h-8 text-indigo-200" />
          </div>
          <h1 className="text-2xl font-black tracking-tight">Sistema de Gestão EBD</h1>
          <p className="text-sm text-indigo-200 mt-1 font-medium">Escola Bíblica Dominical</p>
          <div className="mt-4 pt-3 border-t border-white/15 text-xs text-indigo-100/80 italic">
            "Instrui o menino no caminho em que deve andar" — Provérbios 22:6
          </div>
        </div>

        {/* Card Body */}
        <div className="p-6 sm:p-8 space-y-6">
          <div className="text-center space-y-1">
            <h2 className="text-lg font-bold text-slate-900">Acesso Restrito</h2>
            <p className="text-xs text-slate-500">
              Entre exclusivamente com sua Conta Google institucional ou pessoal autorizada.
            </p>
          </div>

          {(authError || localError) && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-3 text-rose-800 text-xs">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{localError || authError}</span>
            </div>
          )}

          {/* Google Sign-In Button */}
          <button
            id="btn-google-login"
            onClick={handleLogin}
            disabled={isSubmitting}
            className="w-full flex items-center justify-center gap-3.5 px-5 py-3.5 bg-white hover:bg-slate-50 active:bg-slate-100 text-slate-700 font-semibold rounded-xl border-2 border-slate-200 hover:border-slate-300 shadow-sm transition-all focus:outline-none focus:ring-4 focus:ring-indigo-100 disabled:opacity-60 disabled:cursor-not-allowed group cursor-pointer"
          >
            {isSubmitting ? (
              <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
                />
                <path
                  fill="#34A853"
                  d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.34 24 12 24z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.14-1.55.38-2.27V6.58H1.25C.45 8.16 0 9.97 0 12s.45 3.84 1.25 5.42l4.03-3.15z"
                />
                <path
                  fill="#EA4335"
                  d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.34 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                />
              </svg>
            )}
            <span className="text-sm">Entrar com o Google</span>
          </button>

          {/* Profiles Information */}
          <div className="pt-4 border-t border-slate-100 space-y-2.5">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
              <Shield className="w-3.5 h-3.5 text-indigo-600" />
              <span>Perfis de Acesso ao Sistema</span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
                <span className="font-bold text-indigo-700 block">MASTER</span>
                <span className="text-slate-500">Gestão global e usuários</span>
              </div>
              <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
                <span className="font-bold text-amber-700 block">DIRIGENTE</span>
                <span className="text-slate-500">Validação e aprovações</span>
              </div>
              <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
                <span className="font-bold text-emerald-700 block">SECRETARIA</span>
                <span className="text-slate-500">Controle e pedidos de lições</span>
              </div>
              <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
                <span className="font-bold text-blue-700 block">TESOURARIA</span>
                <span className="text-slate-500">Lançamentos de caixa</span>
              </div>
            </div>

            <p className="text-[11px] text-slate-400 text-center pt-2">
              Novos cadastros passam por aprovação de perfil pelo administrador Master.
            </p>
          </div>
        </div>

      </div>
    </div>
  );
};

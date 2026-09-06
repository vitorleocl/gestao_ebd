import React from 'react';
import { Clock, ShieldAlert, LogOut, RefreshCw, CheckCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const PendingApprovalView: React.FC = () => {
  const { currentUser, userProfile, signOutUser } = useAuth();

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl shadow-slate-200 border border-slate-200 overflow-hidden">
        
        {/* Amber Alert Header */}
        <div className="bg-amber-500 p-6 text-white text-center">
          <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-md mx-auto flex items-center justify-center mb-3">
            <Clock className="w-8 h-8 text-white animate-pulse" />
          </div>
          <h1 className="text-xl font-bold">Aguardando Definição de Perfil</h1>
          <p className="text-xs text-amber-100 mt-1 font-medium">Acesso temporariamente restrito</p>
        </div>

        {/* Content */}
        <div className="p-6 sm:p-8 space-y-6">
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-center gap-3.5">
            {currentUser?.photoURL ? (
              <img
                src={currentUser.photoURL}
                alt="Foto"
                className="w-12 h-12 rounded-full border border-slate-300 object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-12 h-12 rounded-full bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center text-lg">
                {currentUser?.displayName ? currentUser.displayName[0] : 'U'}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-slate-900 truncate">
                {currentUser?.displayName || 'Usuário Conectado'}
              </p>
              <p className="text-xs text-slate-500 truncate">{currentUser?.email}</p>
              <span className="inline-block mt-1 text-[11px] font-semibold px-2 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200">
                Status: Pendente de Perfil
              </span>
            </div>
          </div>

          <div className="space-y-3 text-sm text-slate-600 leading-relaxed">
            <p>
              Olá! Seu login com o Google foi realizado com sucesso, porém seu usuário ainda não possui um perfil atribuído.
            </p>
            <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-900 flex items-start gap-2.5">
              <ShieldAlert className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">O que fazer agora?</span>
                <p className="mt-0.5 text-blue-800">
                  Solicite ao administrador <strong className="font-semibold">MASTER</strong> da EBD a liberação e atribuição do seu perfil (<em className="font-medium">Dirigente, Secretaria ou Tesouraria</em>).
                </p>
              </div>
            </div>
            <p className="text-xs text-slate-500 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
              <span>Esta tela atualiza automaticamente assim que seu perfil for aprovado.</span>
            </p>
          </div>

          {/* Actions */}
          <div className="pt-2 flex flex-col sm:flex-row gap-3">
            <button
              id="btn-reload-status"
              onClick={() => window.location.reload()}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-xl transition-colors text-sm shadow-sm cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Atualizar Verificação</span>
            </button>
            <button
              id="btn-pending-signout"
              onClick={signOutUser}
              className="flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-rose-50 text-slate-700 hover:text-rose-700 border border-slate-200 hover:border-rose-200 font-medium rounded-xl transition-colors text-sm cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span>Sair</span>
            </button>
          </div>

        </div>

      </div>
    </div>
  );
};

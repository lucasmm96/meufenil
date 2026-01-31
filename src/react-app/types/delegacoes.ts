// src/react-app/types/delegacoes.ts
export type DelegacaoAcesso = {
  id: string;
  owner_id: string;
  delegate_id: string;
  created_at: string;
  revoked_at: string | null;

  owner?: {
    nome: string | null;
    email: string;
  };

  delegate?: {
    nome: string | null;
    email: string;
  };
};

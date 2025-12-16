import { useState } from "react";
import { Shield, X } from "lucide-react";

interface ConsentimentoLGPDProps {
  onAccept: () => void;
}

export default function ConsentimentoLGPD({ onAccept }: ConsentimentoLGPDProps) {
  const [isOpen, setIsOpen] = useState(true);

  const handleAccept = () => {
    onAccept();
    setIsOpen(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                <Shield className="w-6 h-6 text-green-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900">
                Consentimento LGPD
              </h2>
            </div>
          </div>

          <div className="space-y-4 text-gray-600">
            <p>
              Bem-vindo ao MeuFenil! Para continuar, precisamos do seu consentimento
              para coletar e processar seus dados conforme a Lei Geral de Proteção de Dados (LGPD).
            </p>

            <div className="bg-gray-50 rounded-xl p-4 space-y-3">
              <h3 className="font-semibold text-gray-900">Dados coletados:</h3>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>Nome e endereço de e-mail (via autenticação Google)</li>
                <li>Registros de consumo de fenilalanina</li>
                <li>Referências de alimentos (globais e pessoais)</li>
                <li>Configurações de perfil (limite diário, timezone)</li>
              </ul>
            </div>

            <div className="bg-gray-50 rounded-xl p-4 space-y-3">
              <h3 className="font-semibold text-gray-900">Finalidade:</h3>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>Fornecer funcionalidades de controle de fenilalanina</li>
                <li>Gerar estatísticas e relatórios personalizados</li>
                <li>Melhorar a experiência do usuário</li>
              </ul>
            </div>

            <div className="bg-gray-50 rounded-xl p-4 space-y-3">
              <h3 className="font-semibold text-gray-900">Seus direitos:</h3>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>Acessar todos os seus dados a qualquer momento</li>
                <li>Exportar seus dados em formato CSV ou JSON</li>
                <li>Solicitar a exclusão completa de sua conta e dados</li>
                <li>Revogar este consentimento a qualquer momento</li>
              </ul>
            </div>

            <p className="text-sm">
              Seus dados são armazenados de forma segura e nunca serão compartilhados
              com terceiros sem o seu consentimento explícito. Você pode gerenciar
              suas preferências na página de Perfil.
            </p>
          </div>

          <div className="flex gap-3 mt-6">
            <button
              onClick={handleAccept}
              className="flex-1 bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-6 py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all"
            >
              Aceitar e Continuar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

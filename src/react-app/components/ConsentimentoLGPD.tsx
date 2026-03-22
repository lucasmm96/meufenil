import { useState } from "react";
import { Shield } from "lucide-react";

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
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto">
        <div className="p-5 sm:p-6 space-y-6">
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center shrink-0">
              <Shield className="w-6 h-6 text-green-600" />
            </div>

            <h2 className="text-xl sm:text-2xl font-bold text-gray-900">
              Consentimento LGPD
            </h2>
          </div>

          <div className="space-y-4 text-gray-600 text-sm sm:text-base">
            <p>
              Bem-vindo ao MeuFenil! Para continuar, precisamos do seu consentimento
              para coletar e processar seus dados conforme a Lei Geral de Proteção de Dados (LGPD).
            </p>

            <div className="bg-gray-50 rounded-xl p-4 space-y-3">
              <h3 className="font-semibold text-gray-900">
                Dados coletados:
              </h3>

              <ul className="list-disc list-inside space-y-1">
                <li>Nome e endereço de e-mail (via autenticação Google)</li>
                <li>Registros de consumo de fenilalanina</li>
                <li>Referências de alimentos (globais e pessoais)</li>
                <li>Configurações de perfil (limite diário, timezone)</li>
              </ul>
            </div>

            <div className="bg-gray-50 rounded-xl p-4 space-y-3">
              <h3 className="font-semibold text-gray-900">
                Finalidade:
              </h3>

              <ul className="list-disc list-inside space-y-1">
                <li>Fornecer funcionalidades de controle de fenilalanina</li>
                <li>Gerar estatísticas e relatórios personalizados</li>
                <li>Melhorar a experiência do usuário</li>
              </ul>
            </div>

            <div className="bg-gray-50 rounded-xl p-4 space-y-3">
              <h3 className="font-semibold text-gray-900">
                Seus direitos:
              </h3>

              <ul className="list-disc list-inside space-y-1">
                <li>Acessar todos os seus dados a qualquer momento</li>
                <li>Exportar seus dados em formato CSV ou JSON</li>
                <li>Solicitar a exclusão completa de sua conta e dados</li>
                <li>Revogar este consentimento a qualquer momento</li>
              </ul>
            </div>

            <p className="text-sm text-gray-600">
              Seus dados são armazenados de forma segura e nunca serão compartilhados
              com terceiros sem o seu consentimento explícito. Você pode gerenciar
              suas preferências na página de Perfil.
            </p>
          </div>

          <div className="pt-2">
            <button
              onClick={handleAccept}
              className="w-full sm:w-auto bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-6 py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all"
            >
              Aceitar e Continuar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
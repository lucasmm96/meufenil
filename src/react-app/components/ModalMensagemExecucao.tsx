import { X } from "lucide-react";
import type { BackgroundJobExecutionDTO } from "@/react-app/services/dtos/background-jobs.dto";

interface ModalMensagemExecucaoProps {
  execution: BackgroundJobExecutionDTO;
  onClose: () => void;
}

export default function ModalMensagemExecucao({
  execution,
  onClose,
}: ModalMensagemExecucaoProps) {
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-md max-h-[92vh] overflow-y-auto">
        <div className="p-5 sm:p-6 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h4 className="text-lg font-semibold text-gray-900">Mensagem da execução</h4>
              <p className="text-sm text-gray-500 mt-1">{execution.job_key}</p>
            </div>

            <button
              onClick={onClose}
              aria-label="Fechar"
              className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-gray-100 transition-colors"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          <p className="text-sm text-gray-700 bg-gray-50 rounded-xl p-3 border border-gray-200 whitespace-pre-wrap break-words">
            {execution.message}
          </p>
        </div>
      </div>
    </div>
  );
}

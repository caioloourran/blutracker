"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Event {
  id: string;
  status: string;
  eventType: string;
  customerName: string | null;
  customerPhone: string | null;
  productName: string | null;
  value: number | null;
  retryCount: number;
  sentAt: string | null;
  errorMessage: string | null;
  metaResponse: string | null;
  whatsappNumber?: { name: string };
}

interface EventDetailModalProps {
  open: boolean;
  onClose: () => void;
  event: Event | null;
}

function formatCurrency(value: number): string {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  });
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function EventDetailModal({
  open,
  onClose,
  event,
}: EventDetailModalProps) {
  if (!event) return null;

  let metaResponseFormatted = "";
  if (event.metaResponse) {
    try {
      metaResponseFormatted = JSON.stringify(JSON.parse(event.metaResponse), null, 2);
    } catch {
      metaResponseFormatted = event.metaResponse;
    }
  }

  const statusColors: Record<string, string> = {
    SENT: "text-green-400",
    FAILED: "text-red-400",
    PENDING: "text-yellow-400",
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="bg-gray-900 border-gray-800 text-white sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-white">Detalhes do Evento</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <span className="text-gray-400">Status:</span>{" "}
              <span className={statusColors[event.status] || "text-gray-300"}>
                {event.status}
              </span>
            </div>
            <div>
              <span className="text-gray-400">Tipo:</span>{" "}
              <span className="text-gray-300">{event.eventType}</span>
            </div>
            <div>
              <span className="text-gray-400">Cliente:</span>{" "}
              <span className="text-gray-300">{event.customerName || "-"}</span>
            </div>
            <div>
              <span className="text-gray-400">Telefone:</span>{" "}
              <span className="text-gray-300">{event.customerPhone || "-"}</span>
            </div>
            <div>
              <span className="text-gray-400">Produto:</span>{" "}
              <span className="text-gray-300">{event.productName || "-"}</span>
            </div>
            <div>
              <span className="text-gray-400">Valor:</span>{" "}
              <span className="text-green-400">
                {event.value != null ? formatCurrency(event.value) : "-"}
              </span>
            </div>
            <div>
              <span className="text-gray-400">Tentativas:</span>{" "}
              <span className="text-gray-300">{event.retryCount}</span>
            </div>
            <div>
              <span className="text-gray-400">Enviado em:</span>{" "}
              <span className="text-gray-300">{formatDate(event.sentAt)}</span>
            </div>
          </div>

          {event.errorMessage && (
            <div className="space-y-1">
              <p className="text-gray-400">Mensagem de erro:</p>
              <pre className="bg-red-900/20 border border-red-800 rounded p-3 text-red-400 text-xs overflow-auto whitespace-pre-wrap break-all">
                {event.errorMessage}
              </pre>
            </div>
          )}

          {metaResponseFormatted && (
            <div className="space-y-1">
              <p className="text-gray-400">Resposta da Meta:</p>
              <pre className="bg-green-900/20 border border-green-800 rounded p-3 text-green-400 text-xs overflow-auto whitespace-pre-wrap break-all max-h-48">
                {metaResponseFormatted}
              </pre>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

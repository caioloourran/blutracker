"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

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
  createdAt: string;
  whatsappNumber?: { name: string };
}

interface EventsTableProps {
  events: Event[];
  onRowClick: (event: Event) => void;
  onRetry: (id: string) => void;
}

function formatCurrency(value: number): string {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  });
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

type BadgeVariant = "default" | "secondary" | "destructive" | "outline" | "ghost" | "link";

function statusBadge(status: string): BadgeVariant {
  if (status === "SENT") return "default";
  if (status === "FAILED") return "destructive";
  return "secondary";
}

export function EventsTable({ events, onRowClick, onRetry }: EventsTableProps) {
  return (
    <div className="rounded-lg border border-gray-800 bg-gray-900 overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="border-gray-800 hover:bg-gray-800/50">
            <TableHead className="text-gray-400">Data</TableHead>
            <TableHead className="text-gray-400">Numero</TableHead>
            <TableHead className="text-gray-400">Cliente</TableHead>
            <TableHead className="text-gray-400">Produto</TableHead>
            <TableHead className="text-gray-400">Valor</TableHead>
            <TableHead className="text-gray-400">Status</TableHead>
            <TableHead className="text-gray-400">Acoes</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {events.length === 0 && (
            <TableRow className="border-gray-800">
              <TableCell colSpan={7} className="text-center text-gray-500 py-8">
                Nenhum evento encontrado.
              </TableCell>
            </TableRow>
          )}
          {events.map((event) => (
            <TableRow
              key={event.id}
              className="border-gray-800 hover:bg-gray-800/50 cursor-pointer"
              onClick={() => onRowClick(event)}
            >
              <TableCell className="text-gray-300 text-xs">
                {formatDate(event.createdAt)}
              </TableCell>
              <TableCell className="text-gray-300 text-xs">
                {event.whatsappNumber?.name || "-"}
              </TableCell>
              <TableCell className="text-gray-300 text-xs">
                <div>{event.customerName || "-"}</div>
                {event.customerPhone && (
                  <div className="text-gray-500">{event.customerPhone}</div>
                )}
              </TableCell>
              <TableCell className="text-gray-300 text-xs max-w-32 truncate">
                {event.productName || "-"}
              </TableCell>
              <TableCell className="text-green-400 text-xs font-medium">
                {event.value != null ? formatCurrency(event.value) : "-"}
              </TableCell>
              <TableCell>
                <Badge variant={statusBadge(event.status)}>
                  {event.status}
                </Badge>
              </TableCell>
              <TableCell onClick={(e) => e.stopPropagation()}>
                {event.status === "FAILED" && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onRetry(event.id)}
                    className="border-gray-700 text-gray-300 hover:bg-gray-800 text-xs"
                  >
                    Reenviar
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

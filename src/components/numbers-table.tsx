"use client";

import { useState } from "react";
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

interface WhatsAppNumber {
  id: string;
  name: string;
  wabaId: string;
  phoneNumberId: string;
  datasetId: string;
  isActive: boolean;
  _count: { events: number };
}

interface NumbersTableProps {
  numbers: WhatsAppNumber[];
  onEdit: (number: WhatsAppNumber) => void;
  onToggle: (id: string, isActive: boolean) => void;
  onDelete: (id: string) => void;
}

export function NumbersTable({
  numbers,
  onEdit,
  onToggle,
  onDelete,
}: NumbersTableProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  function copyWebhookUrl(numberId: string) {
    const url = `${window.location.origin}/api/webhooks/bluvesales?numberId=${numberId}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedId(numberId);
      setTimeout(() => setCopiedId(null), 2000);
    });
  }

  return (
    <div className="rounded-lg border border-gray-800 bg-gray-900 overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="border-gray-800 hover:bg-gray-800/50">
            <TableHead className="text-gray-400">Nome</TableHead>
            <TableHead className="text-gray-400">WABA ID</TableHead>
            <TableHead className="text-gray-400">Phone Number ID</TableHead>
            <TableHead className="text-gray-400">Dataset ID</TableHead>
            <TableHead className="text-gray-400">Eventos</TableHead>
            <TableHead className="text-gray-400">Status</TableHead>
            <TableHead className="text-gray-400">Webhook URL</TableHead>
            <TableHead className="text-gray-400">Acoes</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {numbers.length === 0 && (
            <TableRow className="border-gray-800">
              <TableCell colSpan={8} className="text-center text-gray-500 py-8">
                Nenhum numero cadastrado.
              </TableCell>
            </TableRow>
          )}
          {numbers.map((number) => (
            <TableRow
              key={number.id}
              className="border-gray-800 hover:bg-gray-800/50"
            >
              <TableCell className="text-white font-medium">
                {number.name}
              </TableCell>
              <TableCell className="text-gray-400 font-mono text-xs">
                {number.wabaId}
              </TableCell>
              <TableCell className="text-gray-400 font-mono text-xs">
                {number.phoneNumberId}
              </TableCell>
              <TableCell className="text-gray-400 font-mono text-xs">
                {number.datasetId}
              </TableCell>
              <TableCell className="text-gray-400">
                {number._count.events}
              </TableCell>
              <TableCell>
                <Badge variant={number.isActive ? "default" : "secondary"}>
                  {number.isActive ? "Ativo" : "Inativo"}
                </Badge>
              </TableCell>
              <TableCell>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyWebhookUrl(number.id)}
                  className="border-gray-700 text-gray-300 hover:bg-gray-800 text-xs"
                >
                  {copiedId === number.id ? "Copiado!" : "Copiar"}
                </Button>
              </TableCell>
              <TableCell>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onEdit(number)}
                    className="border-gray-700 text-gray-300 hover:bg-gray-800 text-xs"
                  >
                    Editar
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onToggle(number.id, !number.isActive)}
                    className="border-gray-700 text-gray-300 hover:bg-gray-800 text-xs"
                  >
                    {number.isActive ? "Desativar" : "Ativar"}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onDelete(number.id)}
                    className="border-red-900 text-red-400 hover:bg-red-900/30 text-xs"
                  >
                    Excluir
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

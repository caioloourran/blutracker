"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EventsTable } from "@/components/events-table";
import { EventDetailModal } from "@/components/event-detail-modal";

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

interface WhatsAppNumber {
  id: string;
  name: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export default function EventsPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [numbers, setNumbers] = useState<WhatsAppNumber[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1,
  });
  const [loading, setLoading] = useState(true);

  const [statusFilter, setStatusFilter] = useState("all");
  const [numberFilter, setNumberFilter] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  useEffect(() => {
    fetch("/api/numbers")
      .then((r) => r.json())
      .then(setNumbers)
      .catch(() => {});
  }, []);

  async function loadEvents(page = 1) {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", "20");
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (numberFilter !== "all") params.set("numberId", numberFilter);
      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);

      const res = await fetch(`/api/events?${params.toString()}`);
      const data = await res.json();
      setEvents(data.events);
      setPagination(data.pagination);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadEvents(currentPage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage]);

  function handleFilter() {
    setCurrentPage(1);
    loadEvents(1);
  }

  function handleRowClick(event: Event) {
    setSelectedEvent(event);
    setDetailOpen(true);
  }

  async function handleRetry(id: string) {
    await fetch(`/api/events/${id}/retry`, { method: "POST" });
    loadEvents(currentPage);
  }

  const inputClass =
    "bg-gray-800 border-gray-700 text-white placeholder-gray-500 focus:border-blue-500 h-8 text-sm";

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Log de Eventos</h1>

      <div className="flex flex-wrap gap-3 items-end">
        <div className="space-y-1">
          <label className="text-xs text-gray-400">Status</label>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v ?? "all")}>
            <SelectTrigger className="bg-gray-800 border-gray-700 text-white w-36 h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-gray-800 border-gray-700 text-white">
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="SENT">SENT</SelectItem>
              <SelectItem value="FAILED">FAILED</SelectItem>
              <SelectItem value="PENDING">PENDING</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <label className="text-xs text-gray-400">Numero</label>
          <Select value={numberFilter} onValueChange={(v) => setNumberFilter(v ?? "all")}>
            <SelectTrigger className="bg-gray-800 border-gray-700 text-white w-48 h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-gray-800 border-gray-700 text-white">
              <SelectItem value="all">Todos</SelectItem>
              {numbers.map((n) => (
                <SelectItem key={n.id} value={n.id}>
                  {n.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <label className="text-xs text-gray-400">Data inicio</label>
          <Input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className={inputClass}
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs text-gray-400">Data fim</label>
          <Input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className={inputClass}
          />
        </div>

        <Button
          onClick={handleFilter}
          className="bg-blue-600 hover:bg-blue-700 text-white h-8"
        >
          Filtrar
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-32 text-gray-400">
          Carregando...
        </div>
      ) : (
        <EventsTable
          events={events}
          onRowClick={handleRowClick}
          onRetry={handleRetry}
        />
      )}

      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-gray-400">
          <span>
            Pagina {pagination.page} de {pagination.totalPages} ({pagination.total} eventos)
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="border-gray-700 text-gray-300 hover:bg-gray-800 disabled:opacity-40"
            >
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage >= pagination.totalPages}
              onClick={() =>
                setCurrentPage((p) => Math.min(pagination.totalPages, p + 1))
              }
              className="border-gray-700 text-gray-300 hover:bg-gray-800 disabled:opacity-40"
            >
              Proximo
            </Button>
          </div>
        </div>
      )}

      <EventDetailModal
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        event={selectedEvent}
      />
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { NumberFormModal } from "@/components/number-form-modal";
import { NumbersTable } from "@/components/numbers-table";

interface WhatsAppNumber {
  id: string;
  name: string;
  wabaId: string;
  phoneNumberId: string;
  datasetId: string;
  isActive: boolean;
  _count: { events: number };
}

export default function NumbersPage() {
  const [numbers, setNumbers] = useState<WhatsAppNumber[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editData, setEditData] = useState<WhatsAppNumber | null>(null);

  async function loadNumbers() {
    setLoading(true);
    try {
      const res = await fetch("/api/numbers");
      const data = await res.json();
      setNumbers(data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadNumbers();
  }, []);

  function openCreate() {
    setEditData(null);
    setModalOpen(true);
  }

  function openEdit(number: WhatsAppNumber) {
    setEditData(number);
    setModalOpen(true);
  }

  async function handleToggle(id: string, isActive: boolean) {
    await fetch(`/api/numbers/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive }),
    });
    loadNumbers();
  }

  async function handleDelete(id: string) {
    if (!confirm("Tem certeza que deseja excluir este numero?")) return;
    await fetch(`/api/numbers/${id}`, { method: "DELETE" });
    loadNumbers();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Numeros</h1>
        <Button
          onClick={openCreate}
          className="bg-blue-600 hover:bg-blue-700 text-white"
        >
          Adicionar Numero
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-32 text-gray-400">
          Carregando...
        </div>
      ) : (
        <NumbersTable
          numbers={numbers}
          onEdit={openEdit}
          onToggle={handleToggle}
          onDelete={handleDelete}
        />
      )}

      <NumberFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSuccess={loadNumbers}
        editData={editData}
      />
    </div>
  );
}

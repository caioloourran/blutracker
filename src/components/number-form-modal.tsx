"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface NumberData {
  id: string;
  name: string;
  wabaId: string;
  phoneNumberId: string;
  datasetId: string;
}

interface NumberFormModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editData?: NumberData | null;
}

const emptyForm = {
  name: "",
  wabaId: "",
  phoneNumberId: "",
  accessToken: "",
  datasetId: "",
};

export function NumberFormModal({
  open,
  onClose,
  onSuccess,
  editData,
}: NumberFormModalProps) {
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const isEdit = Boolean(editData);

  useEffect(() => {
    if (editData) {
      setForm({
        name: editData.name,
        wabaId: editData.wabaId,
        phoneNumberId: editData.phoneNumberId,
        accessToken: "",
        datasetId: editData.datasetId,
      });
    } else {
      setForm(emptyForm);
    }
    setError("");
  }, [editData, open]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!isEdit) {
      if (!form.name || !form.wabaId || !form.phoneNumberId || !form.accessToken || !form.datasetId) {
        setError("Todos os campos sao obrigatorios.");
        return;
      }
    } else {
      if (!form.name || !form.wabaId || !form.phoneNumberId || !form.datasetId) {
        setError("Todos os campos sao obrigatorios.");
        return;
      }
    }

    setLoading(true);

    try {
      const payload: Record<string, string> = {
        name: form.name,
        wabaId: form.wabaId,
        phoneNumberId: form.phoneNumberId,
        datasetId: form.datasetId,
      };
      if (form.accessToken) {
        payload.accessToken = form.accessToken;
      }

      const url = isEdit ? `/api/numbers/${editData!.id}` : "/api/numbers";
      const method = isEdit ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Erro ao salvar numero.");
        return;
      }

      onSuccess();
      onClose();
    } catch {
      setError("Erro ao salvar numero.");
    } finally {
      setLoading(false);
    }
  }

  const inputClass =
    "bg-gray-800 border-gray-700 text-white placeholder-gray-500 focus:border-blue-500 focus:ring-blue-500";

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="bg-gray-900 border-gray-800 text-white sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-white">
            {isEdit ? "Editar Numero" : "Adicionar Numero"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name" className="text-gray-400">
              Nome
            </Label>
            <Input
              id="name"
              name="name"
              value={form.name}
              onChange={handleChange}
              placeholder="Nome do numero"
              className={inputClass}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="wabaId" className="text-gray-400">
              WABA ID
            </Label>
            <Input
              id="wabaId"
              name="wabaId"
              value={form.wabaId}
              onChange={handleChange}
              placeholder="ID do WABA"
              className={inputClass}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phoneNumberId" className="text-gray-400">
              Phone Number ID
            </Label>
            <Input
              id="phoneNumberId"
              name="phoneNumberId"
              value={form.phoneNumberId}
              onChange={handleChange}
              placeholder="ID do numero de telefone"
              className={inputClass}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="accessToken" className="text-gray-400">
              Access Token
            </Label>
            <Input
              id="accessToken"
              name="accessToken"
              type="password"
              value={form.accessToken}
              onChange={handleChange}
              placeholder={
                isEdit ? "Deixe vazio para manter atual" : "Access token da API"
              }
              className={inputClass}
              required={!isEdit}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="datasetId" className="text-gray-400">
              Dataset ID
            </Label>
            <Input
              id="datasetId"
              name="datasetId"
              value={form.datasetId}
              onChange={handleChange}
              placeholder="ID do dataset"
              className={inputClass}
              required
            />
          </div>
          {error && (
            <p className="text-sm text-red-400">{error}</p>
          )}
          <DialogFooter className="border-gray-800 bg-gray-900">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="border-gray-700 text-gray-300 hover:bg-gray-800"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {loading ? "Salvando..." : isEdit ? "Salvar" : "Adicionar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

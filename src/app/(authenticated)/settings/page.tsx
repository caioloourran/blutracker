"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function SettingsPage() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSuccessMessage("");
    setErrorMessage("");

    if (!currentPassword || !newPassword) {
      setErrorMessage("Preencha todos os campos.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMessage(data.error || "Erro ao alterar senha.");
        return;
      }

      setSuccessMessage("Senha alterada com sucesso!");
      setCurrentPassword("");
      setNewPassword("");
    } catch {
      setErrorMessage("Erro ao alterar senha.");
    } finally {
      setLoading(false);
    }
  }

  const inputClass =
    "bg-gray-800 border-gray-700 text-white placeholder-gray-500 focus:border-blue-500";

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Configuracoes</h1>

      <Card className="bg-gray-900 border-gray-800 text-white max-w-md">
        <CardHeader>
          <CardTitle className="text-white">Alterar Senha</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="currentPassword" className="text-gray-400">
                Senha atual
              </Label>
              <Input
                id="currentPassword"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Digite sua senha atual"
                className={inputClass}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="newPassword" className="text-gray-400">
                Nova senha
              </Label>
              <Input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Digite sua nova senha"
                className={inputClass}
                required
              />
            </div>

            {successMessage && (
              <p className="text-sm text-green-400">{successMessage}</p>
            )}
            {errorMessage && (
              <p className="text-sm text-red-400">{errorMessage}</p>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white"
            >
              {loading ? "Alterando..." : "Alterar Senha"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

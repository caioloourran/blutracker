"use client";

import { useEffect, useState } from "react";
import { StatsCards } from "@/components/stats-cards";
import { EventsChart } from "@/components/events-chart";

interface DashboardStats {
  cards: {
    today: number;
    week: number;
    month: number;
    totalValue: number;
  };
  dailyEvents: Array<{ date: string; count: number }>;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/dashboard/stats")
      .then((res) => res.json())
      .then((data) => {
        setStats(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        Carregando dashboard...
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="flex items-center justify-center h-64 text-red-400">
        Erro ao carregar dashboard.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Dashboard</h1>
      <StatsCards
        today={stats.cards.today}
        week={stats.cards.week}
        month={stats.cards.month}
        totalValue={stats.cards.totalValue}
      />
      <EventsChart data={stats.dailyEvents} />
    </div>
  );
}

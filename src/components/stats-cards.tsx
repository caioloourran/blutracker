"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface StatsCardsProps {
  today: number;
  week: number;
  month: number;
  totalValue: number;
}

function formatCurrency(value: number): string {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  });
}

export function StatsCards({ today, week, month, totalValue }: StatsCardsProps) {
  const cards = [
    { title: "Eventos Hoje", value: today.toString(), subtitle: "nas ultimas 24h" },
    { title: "Eventos (7 dias)", value: week.toString(), subtitle: "ultimos 7 dias" },
    { title: "Eventos (30 dias)", value: month.toString(), subtitle: "ultimos 30 dias" },
    { title: "Valor Total (30 dias)", value: formatCurrency(totalValue), subtitle: "vendas enviadas", green: true },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <Card
          key={card.title}
          className="bg-gray-900 border-gray-800 text-white"
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-400">
              {card.title}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold ${
                card.green ? "text-green-400" : "text-white"
              }`}
            >
              {card.value}
            </div>
            <p className="text-xs text-gray-500 mt-1">{card.subtitle}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

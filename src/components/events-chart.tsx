"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface DailyEvent {
  date: string;
  count: number;
}

interface EventsChartProps {
  data: DailyEvent[];
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00");
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${day}/${month}`;
}

export function EventsChart({ data }: EventsChartProps) {
  const chartData = data.map((item) => ({
    date: formatDate(item.date),
    count: item.count,
  }));

  return (
    <Card className="bg-gray-900 border-gray-800 text-white">
      <CardHeader>
        <CardTitle className="text-white">Eventos por Dia (30 dias)</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis
              dataKey="date"
              tick={{ fill: "#9CA3AF", fontSize: 12 }}
              axisLine={{ stroke: "#4B5563" }}
              tickLine={{ stroke: "#4B5563" }}
            />
            <YAxis
              tick={{ fill: "#9CA3AF", fontSize: 12 }}
              axisLine={{ stroke: "#4B5563" }}
              tickLine={{ stroke: "#4B5563" }}
              allowDecimals={false}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#1F2937",
                border: "1px solid #374151",
                borderRadius: "8px",
                color: "#F9FAFB",
              }}
              labelStyle={{ color: "#D1D5DB" }}
              itemStyle={{ color: "#60A5FA" }}
            />
            <Line
              type="monotone"
              dataKey="count"
              stroke="#2563EB"
              strokeWidth={2}
              dot={{ fill: "#2563EB", strokeWidth: 2, r: 4 }}
              activeDot={{ r: 6, fill: "#60A5FA" }}
              name="Eventos"
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

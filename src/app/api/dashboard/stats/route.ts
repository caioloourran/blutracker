import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const now = new Date();
  const today = new Date(now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  today.setHours(0, 0, 0, 0);

  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [
    todayEvents,
    weekEvents,
    monthEvents,
    totalValue,
    successRate,
    dailyEvents,
    eventsByNumber,
  ] = await Promise.all([
    prisma.event.count({ where: { createdAt: { gte: today } } }),
    prisma.event.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
    prisma.event.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
    prisma.event.aggregate({
      where: { status: "SENT", createdAt: { gte: thirtyDaysAgo } },
      _sum: { value: true },
    }),
    prisma.event.groupBy({
      by: ["status"],
      where: { createdAt: { gte: thirtyDaysAgo } },
      _count: true,
    }),
    prisma.$queryRaw`
      SELECT DATE(created_at AT TIME ZONE 'America/Sao_Paulo') as date,
             COUNT(*)::int as count
      FROM "Event"
      WHERE created_at >= ${thirtyDaysAgo}
      GROUP BY DATE(created_at AT TIME ZONE 'America/Sao_Paulo')
      ORDER BY date ASC
    `,
    prisma.event.groupBy({
      by: ["whatsappNumberId"],
      where: { createdAt: { gte: thirtyDaysAgo } },
      _count: true,
    }),
  ]);

  return NextResponse.json({
    cards: {
      today: todayEvents,
      week: weekEvents,
      month: monthEvents,
      totalValue: totalValue._sum.value || 0,
    },
    successRate,
    dailyEvents,
    eventsByNumber,
  });
}

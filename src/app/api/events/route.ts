import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { Prisma } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const searchParams = req.nextUrl.searchParams;
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "20");
  const status = searchParams.get("status");
  const numberId = searchParams.get("numberId");
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");

  const where: Prisma.EventWhereInput = {};
  if (status) where.status = status as Prisma.EnumEventStatusFilter["equals"];
  if (numberId) where.whatsappNumberId = numberId;
  if (startDate || endDate) {
    const createdAt: Prisma.DateTimeFilter = {};
    if (startDate) createdAt.gte = new Date(startDate);
    if (endDate) createdAt.lte = new Date(endDate);
    where.createdAt = createdAt;
  }

  const [events, total] = await Promise.all([
    prisma.event.findMany({
      where,
      include: { whatsappNumber: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.event.count({ where }),
  ]);

  return NextResponse.json({
    events,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}

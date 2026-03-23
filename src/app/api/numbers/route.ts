import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { encrypt } from "@/lib/encryption";
import { v4 as uuidv4 } from "uuid";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const numbers = await prisma.whatsAppNumber.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      wabaId: true,
      phoneNumberId: true,
      datasetId: true,
      webhookSecret: true,
      isActive: true,
      createdAt: true,
      _count: { select: { events: true } },
    },
  });

  return NextResponse.json(numbers);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { name, wabaId, phoneNumberId, accessToken, datasetId } = body;

  if (!name || !wabaId || !phoneNumberId || !accessToken || !datasetId) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const number = await prisma.whatsAppNumber.create({
    data: {
      name,
      wabaId,
      phoneNumberId,
      accessToken: encrypt(accessToken),
      datasetId,
      webhookSecret: uuidv4(),
    },
  });

  return NextResponse.json(number, { status: 201 });
}

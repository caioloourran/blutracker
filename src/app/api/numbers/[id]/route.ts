import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { encrypt } from "@/lib/encryption";

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const number = await prisma.whatsAppNumber.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      name: true,
      wabaId: true,
      phoneNumberId: true,
      datasetId: true,
      webhookSecret: true,
      isActive: true,
      createdAt: true,
    },
  });

  if (!number) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(number);
}

export async function PUT(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const data: any = {};

  if (body.name) data.name = body.name;
  if (body.wabaId) data.wabaId = body.wabaId;
  if (body.phoneNumberId) data.phoneNumberId = body.phoneNumberId;
  if (body.datasetId) data.datasetId = body.datasetId;
  if (body.accessToken) data.accessToken = encrypt(body.accessToken);
  if (typeof body.isActive === "boolean") data.isActive = body.isActive;

  const number = await prisma.whatsAppNumber.update({
    where: { id: params.id },
    data,
  });

  return NextResponse.json(number);
}

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await prisma.whatsAppNumber.delete({ where: { id: params.id } });

  return NextResponse.json({ status: "deleted" });
}

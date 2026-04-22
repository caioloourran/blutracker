import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/encryption";
import { buildUserData } from "@/lib/hash";
import { buildCapiPayload, sendEvent } from "@/lib/meta-capi";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// NOTE: next/server's after() may not be available in Next.js 14.
// If it's not available, use a fire-and-forget pattern instead.
let afterFn: ((fn: () => void) => void) | undefined;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  afterFn = require("next/server").after;
} catch {
  afterFn = undefined;
}

interface WebhookCustomer {
  phone: string;
  email?: string;
  name: string;
  document?: string;
  address?: {
    city?: string;
    state?: string;
    zipcode?: string;
    country?: string;
  };
}

interface WebhookOrder {
  id: string;
  created_at?: string;
}

interface WebhookProduct {
  name: string;
  plan?: string;
  price: number;
}

interface WebhookBody {
  event: string;
  order: WebhookOrder;
  customer: WebhookCustomer;
  product: WebhookProduct;
}

export async function POST(req: NextRequest) {
  try {
    // 1. Extract numberId and secret
    // Use nextUrl if available (real NextRequest), otherwise fall back to URL parsing (tests)
    const url = req.nextUrl ?? new URL(req.url);
    const numberId = url.searchParams.get("numberId");
    if (!numberId) {
      return NextResponse.json(
        { error: "Missing numberId parameter" },
        { status: 400 }
      );
    }

    const secret = req.headers.get("X-Webhook-Secret");
    if (!secret) {
      return NextResponse.json(
        { error: "Invalid secret" },
        { status: 401 }
      );
    }

    // 2. Find and validate number
    const number = await prisma.whatsAppNumber.findUnique({
      where: { id: numberId },
    });

    if (!number || !number.isActive || number.webhookSecret !== secret) {
      return NextResponse.json(
        { error: "Invalid secret" },
        { status: 401 }
      );
    }

    // 3. Parse and validate payload
    const body: WebhookBody = await req.json();

    if (body.event !== "ORDER_CREATE") {
      return NextResponse.json(
        { error: "Unsupported event type" },
        { status: 400 }
      );
    }

    const { order, customer, product } = body;

    if (!customer?.phone || !product?.price || !order?.id) {
      return NextResponse.json(
        { error: "Missing required fields: customer.phone, product.price, order.id" },
        { status: 400 }
      );
    }

    // 4. Check for duplicates
    const existing = await prisma.event.findFirst({
      where: { whatsappNumberId: numberId, orderId: order.id },
    });

    if (existing) {
      return NextResponse.json({ status: "duplicate" });
    }

    // 5. Save event as PENDING with rawPayload for retries
    const event = await prisma.event.create({
      data: {
        whatsappNumberId: numberId,
        type: "PURCHASE",
        status: "PENDING",
        orderId: order.id,
        customerPhone: customer.phone,
        customerEmail: customer.email || null,
        customerName: customer.name,
        productName: `${product.name}${product.plan ? ` - ${product.plan}` : ""}`,
        value: product.price,
        rawPayload: body as unknown as Prisma.InputJsonValue,
      },
    });

    // 6. Send to Meta CAPI asynchronously after response
    // Use after() if available (Next.js 15+), otherwise fire-and-forget
    const asyncSend = () =>
      sendToMeta(event.id, number.accessToken, number.datasetId, body).catch(
        (err) => console.error(`Failed to send event ${event.id} to Meta:`, err)
      );

    if (afterFn) {
      afterFn(asyncSend);
    } else {
      asyncSend();
    }

    // 7. Return immediately
    return NextResponse.json({
      status: "received",
      eventId: event.id,
    });
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

async function sendToMeta(
  eventId: string,
  encryptedToken: string,
  datasetId: string,
  webhookBody: WebhookBody
) {
  try {
    const accessToken = decrypt(encryptedToken);
    const { order, customer, product } = webhookBody;

    const userData = buildUserData({
      phone: customer.phone,
      email: customer.email,
      name: customer.name,
      document: customer.document || "",
      city: customer.address?.city || "",
      state: customer.address?.state || "",
      zipcode: customer.address?.zipcode || "",
      country: customer.address?.country || "BR",
    });

    const eventTime = order.created_at
      ? Math.floor(new Date(order.created_at).getTime() / 1000)
      : Math.floor(Date.now() / 1000);

    const payload = buildCapiPayload({
      eventName: "Purchase",
      eventTime,
      eventId: order.id,
      userData,
      customData: {
        value: product.price,
        currency: "BRL",
        content_name: `${product.name}${product.plan ? ` - ${product.plan}` : ""}`,
        content_type: "product",
        order_id: order.id,
      },
    });

    const metaResponse = await sendEvent({ datasetId, accessToken, payload });

    await prisma.event.update({
      where: { id: eventId },
      data: {
        status: "SENT",
        metaResponse: metaResponse as Prisma.InputJsonValue,
        sentAt: new Date(),
      },
    });
  } catch (error: unknown) {
    await prisma.event.update({
      where: { id: eventId },
      data: {
        status: "FAILED",
        errorMessage: error instanceof Error ? error.message : String(error),
        retryCount: { increment: 1 },
      },
    });
  }
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/encryption";
import { buildUserData } from "@/lib/hash";
import { buildCapiPayload, sendEvent } from "@/lib/meta-capi";

export async function GET(req: Request) {
  // Verify cron secret
  const authHeader = req.headers.get("Authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Find retryable events: FAILED or PENDING with retryCount < 3
  const events = await prisma.event.findMany({
    where: {
      status: { in: ["FAILED", "PENDING"] },
      retryCount: { lt: 3 },
    },
    include: { whatsappNumber: true },
    take: 50,
  });

  const now = Date.now();
  let processed = 0;

  for (const event of events) {
    // Backoff: retry after (retryCount + 1) * 15 minutes
    const backoffMs = (event.retryCount + 1) * 15 * 60 * 1000;
    const eligibleAfter = new Date(event.updatedAt).getTime() + backoffMs;

    if (now < eligibleAfter) continue;

    try {
      const accessToken = decrypt(event.whatsappNumber.accessToken);

      // Use rawPayload for full user data on retries
      const raw = event.rawPayload as any;
      const customer = raw.customer;

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

      const payload = buildCapiPayload({
        eventName: "Purchase",
        eventTime: Math.floor(event.createdAt.getTime() / 1000),
        eventId: event.orderId,
        userData,
        customData: {
          value: Number(event.value),
          currency: event.currency,
          content_name: event.productName,
          content_type: "product",
          order_id: event.orderId,
        },
      });

      const metaResponse = await sendEvent({
        datasetId: event.whatsappNumber.datasetId,
        accessToken,
        payload,
      });

      await prisma.event.update({
        where: { id: event.id },
        data: {
          status: "SENT",
          metaResponse: metaResponse as any,
          sentAt: new Date(),
        },
      });

      processed++;
    } catch (error: any) {
      await prisma.event.update({
        where: { id: event.id },
        data: {
          status: "FAILED",
          errorMessage: error.message,
          retryCount: { increment: 1 },
        },
      });
    }
  }

  return NextResponse.json({ processed, total: events.length });
}

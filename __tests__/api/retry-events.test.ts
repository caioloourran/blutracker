import { GET } from "@/app/api/cron/retry-events/route";
import { prisma } from "@/lib/prisma";

jest.mock("@/lib/prisma", () => ({
  prisma: {
    event: {
      findMany: jest.fn(),
      update: jest.fn(),
    },
    whatsAppNumber: {
      findUnique: jest.fn(),
    },
  },
}));

jest.mock("@/lib/meta-capi", () => ({
  buildCapiPayload: jest.fn().mockReturnValue({ data: [] }),
  sendEvent: jest.fn().mockResolvedValue({ events_received: 1 }),
}));

jest.mock("@/lib/encryption", () => ({
  decrypt: jest.fn().mockReturnValue("decrypted-token"),
}));

jest.mock("@/lib/hash", () => ({
  buildUserData: jest.fn().mockReturnValue({ ph: ["hash"] }),
}));

describe("GET /api/cron/retry-events", () => {
  it("returns 401 without CRON_SECRET", async () => {
    const req = new Request("http://localhost:3000/api/cron/retry-events");
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("processes retryable events", async () => {
    process.env.CRON_SECRET = "test-secret";

    (prisma.event.findMany as jest.Mock).mockResolvedValue([]);

    const req = new Request("http://localhost:3000/api/cron/retry-events", {
      headers: { Authorization: "Bearer test-secret" },
    });
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.processed).toBe(0);
  });
});

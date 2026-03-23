import { POST } from "@/app/api/webhooks/bluvesales/route";
import { prisma } from "@/lib/prisma";

// Mock prisma
jest.mock("@/lib/prisma", () => ({
  prisma: {
    whatsAppNumber: {
      findUnique: jest.fn(),
    },
    event: {
      create: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
  },
}));

// Mock meta-capi
jest.mock("@/lib/meta-capi", () => ({
  buildCapiPayload: jest.fn().mockReturnValue({ data: [] }),
  sendEvent: jest.fn().mockResolvedValue({ events_received: 1 }),
}));

// Mock encryption
jest.mock("@/lib/encryption", () => ({
  decrypt: jest.fn().mockReturnValue("decrypted-token"),
}));

// Mock next/server after() — it's used for async processing after response
jest.mock("next/server", () => {
  const actual = jest.requireActual("next/server");
  return {
    ...actual,
    after: jest.fn((fn) => fn()),
  };
});

const validPayload = {
  event: "ORDER_CREATE",
  order: { id: "BLV-0001", internal_id: 1, status: "cadastrados", created_at: "2026-03-22T10:30:00-03:00" },
  customer: {
    name: "Joao Silva",
    document: "123.456.789-00",
    email: "joao@email.com",
    phone: "11999999999",
    address: { street: "Rua X", number: "100", complement: null, neighborhood: "Centro", city: "Sao Paulo", state: "SP", zipcode: "01000-000", country: "BR" },
  },
  product: { name: "Reduza", plan: "6 Meses", price: 697.0 },
  seller: { name: "Caio" },
};

function makeRequest(body: unknown, numberId?: string, secret?: string) {
  const url = `http://localhost:3000/api/webhooks/bluvesales?numberId=${numberId || "num-1"}`;
  return new Request(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(secret ? { "X-Webhook-Secret": secret } : {}),
    },
    body: JSON.stringify(body),
  });
}

describe("POST /api/webhooks/bluvesales", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 401 when secret is missing", async () => {
    const req = makeRequest(validPayload, "num-1");
    const res = await POST(req as any);
    expect(res.status).toBe(401);
  });

  it("returns 401 when secret is invalid", async () => {
    (prisma.whatsAppNumber.findUnique as jest.Mock).mockResolvedValue({
      id: "num-1",
      webhookSecret: "correct-secret",
      isActive: true,
    });
    const req = makeRequest(validPayload, "num-1", "wrong-secret");
    const res = await POST(req as any);
    expect(res.status).toBe(401);
  });

  it("returns 400 when numberId is missing", async () => {
    const url = "http://localhost:3000/api/webhooks/bluvesales";
    const req = new Request(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Webhook-Secret": "s" },
      body: JSON.stringify(validPayload),
    });
    const res = await POST(req as any);
    expect(res.status).toBe(400);
  });

  it("returns 200 with received status on valid request", async () => {
    (prisma.whatsAppNumber.findUnique as jest.Mock).mockResolvedValue({
      id: "num-1",
      webhookSecret: "valid-secret",
      isActive: true,
      accessToken: "encrypted-token",
      datasetId: "DS_123",
    });
    (prisma.event.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.event.create as jest.Mock).mockResolvedValue({ id: "evt-1" });

    const req = makeRequest(validPayload, "num-1", "valid-secret");
    const res = await POST(req as any);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.status).toBe("received");
    expect(body.eventId).toBe("evt-1");
  });

  it("returns 200 duplicate when order already exists", async () => {
    (prisma.whatsAppNumber.findUnique as jest.Mock).mockResolvedValue({
      id: "num-1",
      webhookSecret: "valid-secret",
      isActive: true,
    });
    (prisma.event.findFirst as jest.Mock).mockResolvedValue({ id: "existing" });

    const req = makeRequest(validPayload, "num-1", "valid-secret");
    const res = await POST(req as any);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.status).toBe("duplicate");
  });
});

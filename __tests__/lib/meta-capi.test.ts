import { buildCapiPayload, sendEvent } from "@/lib/meta-capi";

describe("buildCapiPayload", () => {
  it("builds correct CAPI payload structure", () => {
    const payload = buildCapiPayload({
      eventName: "Purchase",
      eventTime: 1711104600,
      eventId: "BLV-0001",
      userData: {
        ph: ["hashedphone"],
        fn: ["hashedfn"],
        ct: ["hashedcity"],
        st: ["hashedstate"],
        zp: ["hashedzip"],
        country: ["hashedcountry"],
        external_id: ["hashedcpf"],
      },
      customData: {
        value: 697.0,
        currency: "BRL",
        content_name: "Reduza - 6 Meses",
        content_type: "product",
        order_id: "BLV-0001",
      },
    });

    expect(payload.data).toHaveLength(1);
    expect(payload.data[0].event_name).toBe("Purchase");
    expect(payload.data[0].action_source).toBe("business_messaging");
    expect(payload.data[0].messaging_channel).toBe("whatsapp");
    expect(payload.data[0].event_id).toBe("BLV-0001");
    expect(payload.data[0].user_data.ph).toEqual(["hashedphone"]);
    expect(payload.data[0].custom_data.value).toBe(697.0);
  });
});

describe("sendEvent", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("calls Meta API with correct URL and headers", async () => {
    process.env.META_API_VERSION = "v21.0";
    const mockResponse = { events_received: 1 };

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    });

    const result = await sendEvent({
      datasetId: "DATASET_123",
      accessToken: "TOKEN_ABC",
      payload: {
        data: [
          {
            event_name: "Purchase",
            event_time: 1711104600,
            event_id: "BLV-0001",
            action_source: "business_messaging" as const,
            messaging_channel: "whatsapp" as const,
            user_data: { ph: ["hash"] },
            custom_data: { value: 100, currency: "BRL" },
          },
        ],
      },
    });

    expect(global.fetch).toHaveBeenCalledWith(
      "https://graph.facebook.com/v21.0/DATASET_123/events",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer TOKEN_ABC",
          "Content-Type": "application/json",
        }),
      })
    );
    expect(result).toEqual(mockResponse);
  });

  it("throws on Meta API error", async () => {
    process.env.META_API_VERSION = "v21.0";

    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: () =>
        Promise.resolve({
          error: { message: "Invalid token", code: 190 },
        }),
    });

    await expect(
      sendEvent({
        datasetId: "DATASET_123",
        accessToken: "BAD_TOKEN",
        payload: { data: [] },
      })
    ).rejects.toThrow("Meta CAPI error");
  });

  it("throws on timeout", async () => {
    process.env.META_API_VERSION = "v21.0";

    global.fetch = jest.fn().mockImplementation(
      () =>
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("AbortError")), 100)
        )
    );

    await expect(
      sendEvent({
        datasetId: "DS",
        accessToken: "TK",
        payload: { data: [] },
      })
    ).rejects.toThrow();
  });
});

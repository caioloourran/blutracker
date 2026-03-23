import {
  normalizePhone,
  normalizeEmail,
  normalizeName,
  normalizeDocument,
  normalizeCity,
  normalizeZipcode,
  hashValue,
  buildUserData,
} from "@/lib/hash";

describe("normalization", () => {
  it("normalizes phone — adds country code", () => {
    expect(normalizePhone("11999999999")).toBe("5511999999999");
  });

  it("normalizes phone — already has country code", () => {
    expect(normalizePhone("5511999999999")).toBe("5511999999999");
  });

  it("normalizes phone — strips non-digits", () => {
    expect(normalizePhone("+55 (11) 99999-9999")).toBe("5511999999999");
  });

  it("normalizes email", () => {
    expect(normalizeEmail("  Joao@Email.COM  ")).toBe("joao@email.com");
  });

  it("normalizes name — splits first/last", () => {
    expect(normalizeName("Joao Silva")).toEqual({
      firstName: "joao",
      lastName: "silva",
    });
  });

  it("normalizes name — single name", () => {
    expect(normalizeName("Joao")).toEqual({
      firstName: "joao",
      lastName: "",
    });
  });

  it("normalizes document — strips dots and dashes", () => {
    expect(normalizeDocument("123.456.789-00")).toBe("12345678900");
  });

  it("normalizes city — lowercase, no accents, no spaces", () => {
    expect(normalizeCity("São Paulo")).toBe("saopaulo");
  });

  it("normalizes zipcode — strips dash", () => {
    expect(normalizeZipcode("01000-000")).toBe("01000000");
  });
});

describe("hashValue", () => {
  it("returns SHA256 hex hash", () => {
    const hash = hashValue("test");
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("produces consistent hash", () => {
    expect(hashValue("test")).toBe(hashValue("test"));
  });
});

describe("buildUserData", () => {
  it("builds complete user_data object for Meta CAPI", () => {
    const userData = buildUserData({
      phone: "11999999999",
      email: "joao@email.com",
      name: "Joao Silva",
      document: "123.456.789-00",
      city: "Sao Paulo",
      state: "SP",
      zipcode: "01000-000",
      country: "BR",
    });

    expect(userData.ph).toHaveLength(1);
    expect(userData.ph[0]).toMatch(/^[a-f0-9]{64}$/);
    expect(userData.em).toHaveLength(1);
    expect(userData.fn).toHaveLength(1);
    expect(userData.ln).toHaveLength(1);
    expect(userData.ct).toHaveLength(1);
    expect(userData.st).toHaveLength(1);
    expect(userData.zp).toHaveLength(1);
    expect(userData.country).toHaveLength(1);
    expect(userData.external_id).toHaveLength(1);
  });

  it("omits email if not provided", () => {
    const userData = buildUserData({
      phone: "11999999999",
      name: "Joao",
      document: "12345678900",
      city: "Sao Paulo",
      state: "SP",
      zipcode: "01000000",
      country: "BR",
    });

    expect(userData.em).toBeUndefined();
  });
});

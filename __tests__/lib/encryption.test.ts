import { encrypt, decrypt } from "@/lib/encryption";

describe("encryption", () => {
  const testKey = "a".repeat(64); // 32 bytes in hex

  beforeAll(() => {
    process.env.ENCRYPTION_KEY = testKey;
  });

  it("encrypts and decrypts a string", () => {
    const plaintext = "EAABsbCS1iHgBO...";
    const encrypted = encrypt(plaintext);
    expect(encrypted).not.toBe(plaintext);
    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe(plaintext);
  });

  it("produces different ciphertext each time (random IV)", () => {
    const plaintext = "same-token";
    const encrypted1 = encrypt(plaintext);
    const encrypted2 = encrypt(plaintext);
    expect(encrypted1).not.toBe(encrypted2);
  });

  it("throws on invalid ciphertext", () => {
    expect(() => decrypt("invalid-data")).toThrow();
  });
});

# Blutracker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a platform that receives Bluvesales webhooks and sends Purchase conversion events to Meta CAPI for Business Messaging, with a dashboard for metrics.

**Architecture:** Next.js 14 App Router monolith with Prisma ORM, PostgreSQL (Vercel Postgres/Neon), NextAuth.js for auth, and shadcn/ui for the dashboard. Webhook endpoint receives orders, saves to DB, then sends to Meta CAPI asynchronously. Cron job retries failed events.

**Tech Stack:** Next.js 14, TypeScript, Prisma, PostgreSQL, NextAuth.js, Tailwind CSS, shadcn/ui, Vercel

**Spec:** `docs/superpowers/specs/2026-03-23-blutracker-design.md`

---

## File Structure

```
blutracker/
├── .env.local                          # Environment variables (local)
├── .env.example                        # Template for env vars
├── next.config.js                      # Next.js configuration
├── tailwind.config.ts                  # Tailwind configuration
├── tsconfig.json                       # TypeScript configuration
├── package.json                        # Dependencies
├── vercel.json                         # Vercel config (cron jobs)
│
├── jest.config.ts                      # Jest configuration
│
├── prisma/
│   ├── schema.prisma                   # Database schema
│   └── seed.ts                         # Seed script for initial user
│
├── src/
│   ├── lib/
│   │   ├── prisma.ts                   # Prisma client singleton
│   │   ├── encryption.ts               # AES-256-GCM encrypt/decrypt for tokens
│   │   ├── hash.ts                     # SHA256 hashing + normalization for Meta CAPI
│   │   ├── meta-capi.ts               # Meta Conversions API client
│   │   └── auth.ts                     # NextAuth configuration
│   │
│   ├── app/
│   │   ├── layout.tsx                  # Root layout (providers, sidebar)
│   │   ├── page.tsx                    # Dashboard home (redirect to /dashboard)
│   │   │
│   │   ├── api/
│   │   │   ├── webhooks/
│   │   │   │   └── bluvesales/
│   │   │   │       └── route.ts        # Webhook endpoint
│   │   │   ├── cron/
│   │   │   │   └── retry-events/
│   │   │   │       └── route.ts        # Cron job for retrying FAILED/PENDING events
│   │   │   ├── auth/
│   │   │   │   ├── [...nextauth]/
│   │   │   │   │   └── route.ts        # NextAuth route handler
│   │   │   │   └── change-password/
│   │   │   │       └── route.ts        # Change password endpoint
│   │   │   ├── numbers/
│   │   │   │   ├── route.ts            # GET (list) + POST (create) numbers
│   │   │   │   └── [id]/
│   │   │   │       └── route.ts        # GET + PUT + DELETE single number
│   │   │   ├── events/
│   │   │   │   ├── route.ts            # GET (list with filters)
│   │   │   │   └── [id]/
│   │   │   │       └── retry/
│   │   │   │           └── route.ts    # POST retry single event
│   │   │   └── dashboard/
│   │   │       └── stats/
│   │   │           └── route.ts        # GET dashboard statistics
│   │   │
│   │   ├── login/
│   │   │   └── page.tsx                # Login page
│   │   │
│   │   └── (authenticated)/
│   │       ├── layout.tsx              # Authenticated layout with sidebar
│   │       ├── dashboard/
│   │       │   └── page.tsx            # Dashboard with charts and cards
│   │       ├── numbers/
│   │       │   └── page.tsx            # WhatsApp numbers management
│   │       ├── events/
│   │       │   └── page.tsx            # Events log with filters
│   │       └── settings/
│   │           └── page.tsx            # Account settings
│   │
│   └── components/
│       ├── sidebar.tsx                 # Navigation sidebar
│       ├── stats-cards.tsx             # Dashboard metric cards
│       ├── events-chart.tsx            # Line chart (events per day)
│       ├── numbers-table.tsx           # WhatsApp numbers table
│       ├── number-form-modal.tsx       # Add/edit number modal
│       ├── events-table.tsx            # Events log table with filters
│       └── event-detail-modal.tsx      # Event detail modal (payload + response)
│
└── __tests__/
    ├── lib/
    │   ├── encryption.test.ts          # Encryption tests
    │   ├── hash.test.ts                # Normalization + hashing tests
    │   └── meta-capi.test.ts           # Meta CAPI client tests
    └── api/
        ├── webhooks.test.ts            # Webhook endpoint tests
        └── retry-events.test.ts        # Cron retry tests
```

---

## Task 1: Project Scaffolding + Prisma Schema

**Files:**
- Create: `package.json`, `next.config.js`, `tailwind.config.ts`, `tsconfig.json`, `.env.example`, `prisma/schema.prisma`, `src/lib/prisma.ts`

- [ ] **Step 1: Initialize Next.js project**

```bash
cd c:/Users/Windows/Desktop/Blutracker
npx create-next-app@14 . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm
```

- [ ] **Step 2: Install dependencies**

```bash
npm install prisma @prisma/client next-auth @auth/prisma-adapter uuid bcryptjs
npm install -D @types/uuid @types/bcryptjs jest @types/jest ts-jest
```

- [ ] **Step 3: Initialize Prisma**

```bash
npx prisma init
```

- [ ] **Step 4: Write Prisma schema**

Write `prisma/schema.prisma`:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_DATABASE_URL")
}

model User {
  id            String    @id @default(cuid())
  email         String    @unique
  passwordHash  String
  name          String?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
}

model WhatsAppNumber {
  id            String    @id @default(cuid())
  name          String
  wabaId        String
  phoneNumberId String
  accessToken   String    // AES-256-GCM encrypted
  datasetId     String
  webhookSecret String    @default(uuid())
  isActive      Boolean   @default(true)
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  events        Event[]
}

enum EventType {
  PURCHASE
}

enum EventStatus {
  PENDING
  SENT
  FAILED
}

model Event {
  id               String        @id @default(cuid())
  whatsappNumberId String
  whatsappNumber   WhatsAppNumber @relation(fields: [whatsappNumberId], references: [id])
  type             EventType     @default(PURCHASE)
  status           EventStatus   @default(PENDING)
  retryCount       Int           @default(0)
  orderId          String
  customerPhone    String
  customerEmail    String?
  customerName     String
  productName      String
  value            Decimal
  currency         String        @default("BRL")
  rawPayload       Json          // Original webhook payload for retries
  metaResponse     Json?
  errorMessage     String?
  sentAt           DateTime?
  createdAt        DateTime      @default(now())
  updatedAt        DateTime      @updatedAt

  @@unique([whatsappNumberId, orderId])
  @@index([whatsappNumberId, createdAt])
  @@index([status])
}
```

- [ ] **Step 5: Create Prisma client singleton**

Write `src/lib/prisma.ts`:

```typescript
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
```

- [ ] **Step 6: Create .env.example**

Write `.env.example`:

```env
# Database (Vercel Postgres / Neon)
DATABASE_URL="postgresql://..."
DIRECT_DATABASE_URL="postgresql://..."

# NextAuth
NEXTAUTH_SECRET="generate-a-random-secret"
NEXTAUTH_URL="http://localhost:3000"

# Encryption key for access tokens (32 bytes hex)
ENCRYPTION_KEY="generate-64-char-hex-string"

# Meta Graph API version
META_API_VERSION="v21.0"

# Cron job secret (for Vercel cron authentication)
CRON_SECRET="generate-a-random-secret"
```

- [ ] **Step 7: Run Prisma migration**

```bash
npx prisma migrate dev --name init
```

- [ ] **Step 8: Verify project runs**

```bash
npm run dev
```

Expected: Next.js starts on http://localhost:3000

- [ ] **Step 9: Commit**

```bash
git init
git add .
git commit -m "chore: scaffold Next.js project with Prisma schema"
```

---

## Task 2: Encryption Library

**Files:**
- Create: `src/lib/encryption.ts`, `__tests__/lib/encryption.test.ts`

- [ ] **Step 1: Configure Jest**

Write `jest.config.ts`:

```typescript
import type { Config } from "jest";

const config: Config = {
  preset: "ts-jest",
  testEnvironment: "node",
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },
};

export default config;
```

Add to `package.json` scripts: `"test": "jest"`

- [ ] **Step 2: Write failing tests for encryption**

Write `__tests__/lib/encryption.test.ts`:

```typescript
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
```

- [ ] **Step 3: Run test to verify it fails**

```bash
npm test -- __tests__/lib/encryption.test.ts
```

Expected: FAIL — cannot find module `@/lib/encryption`

- [ ] **Step 4: Implement encryption**

Write `src/lib/encryption.ts`:

```typescript
import { randomBytes, createCipheriv, createDecipheriv } from "crypto";

function getKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  if (!key || key.length !== 64) {
    throw new Error("ENCRYPTION_KEY must be a 64-char hex string (32 bytes)");
  }
  return Buffer.from(key, "hex");
}

export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  // Format: iv:authTag:ciphertext (all base64)
  return [
    iv.toString("base64"),
    authTag.toString("base64"),
    encrypted.toString("base64"),
  ].join(":");
}

export function decrypt(ciphertext: string): string {
  const key = getKey();
  const parts = ciphertext.split(":");
  if (parts.length !== 3) throw new Error("Invalid ciphertext format");
  const [ivB64, authTagB64, encryptedB64] = parts;
  const iv = Buffer.from(ivB64, "base64");
  const authTag = Buffer.from(authTagB64, "base64");
  const encrypted = Buffer.from(encryptedB64, "base64");
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npm test -- __tests__/lib/encryption.test.ts
```

Expected: 3 tests PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/encryption.ts __tests__/lib/encryption.test.ts jest.config.ts
git commit -m "feat: add AES-256-GCM encryption for access tokens"
```

---

## Task 3: SHA256 Hashing + Normalization

**Files:**
- Create: `src/lib/hash.ts`, `__tests__/lib/hash.test.ts`

- [ ] **Step 1: Write failing tests**

Write `__tests__/lib/hash.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- __tests__/lib/hash.test.ts
```

Expected: FAIL — cannot find module

- [ ] **Step 3: Implement hash library**

Write `src/lib/hash.ts`:

```typescript
import { createHash } from "crypto";

export function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return digits.startsWith("55") ? digits : `55${digits}`;
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function normalizeName(fullName: string): {
  firstName: string;
  lastName: string;
} {
  const trimmed = fullName.trim().toLowerCase();
  const spaceIndex = trimmed.indexOf(" ");
  if (spaceIndex === -1) {
    return { firstName: trimmed, lastName: "" };
  }
  return {
    firstName: trimmed.substring(0, spaceIndex),
    lastName: trimmed.substring(spaceIndex + 1),
  };
}

export function normalizeDocument(doc: string): string {
  return doc.replace(/[.\-/]/g, "");
}

export function normalizeCity(city: string): string {
  return city
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "");
}

export function normalizeZipcode(zip: string): string {
  return zip.replace(/\D/g, "");
}

export function hashValue(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

interface UserDataInput {
  phone: string;
  email?: string;
  name: string;
  document: string;
  city: string;
  state: string;
  zipcode: string;
  country: string;
}

interface MetaUserData {
  ph: string[];
  em?: string[];
  fn: string[];
  ln?: string[];
  ct: string[];
  st: string[];
  zp: string[];
  country: string[];
  external_id: string[];
}

export function buildUserData(input: UserDataInput): MetaUserData {
  const phone = normalizePhone(input.phone);
  const { firstName, lastName } = normalizeName(input.name);
  const doc = normalizeDocument(input.document);
  const city = normalizeCity(input.city);
  const state = input.state.trim().toLowerCase();
  const zip = normalizeZipcode(input.zipcode);
  const country = input.country.trim().toLowerCase();

  const userData: MetaUserData = {
    ph: [hashValue(phone)],
    fn: [hashValue(firstName)],
    ct: [hashValue(city)],
    st: [hashValue(state)],
    zp: [hashValue(zip)],
    country: [hashValue(country)],
    external_id: [hashValue(doc)],
  };

  if (input.email) {
    userData.em = [hashValue(normalizeEmail(input.email))];
  }

  if (lastName) {
    userData.ln = [hashValue(lastName)];
  }

  return userData;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- __tests__/lib/hash.test.ts
```

Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/hash.ts __tests__/lib/hash.test.ts
git commit -m "feat: add SHA256 hashing and normalization for Meta CAPI user_data"
```

---

## Task 4: Meta CAPI Client

**Files:**
- Create: `src/lib/meta-capi.ts`, `__tests__/lib/meta-capi.test.ts`

- [ ] **Step 1: Write failing tests**

Write `__tests__/lib/meta-capi.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- __tests__/lib/meta-capi.test.ts
```

Expected: FAIL

- [ ] **Step 3: Implement Meta CAPI client**

Write `src/lib/meta-capi.ts`:

```typescript
interface MetaUserData {
  ph?: string[];
  em?: string[];
  fn?: string[];
  ln?: string[];
  ct?: string[];
  st?: string[];
  zp?: string[];
  country?: string[];
  external_id?: string[];
}

interface MetaCustomData {
  value: number;
  currency: string;
  content_name?: string;
  content_type?: string;
  order_id?: string;
}

interface MetaEventData {
  event_name: string;
  event_time: number;
  event_id: string;
  action_source: "business_messaging";
  messaging_channel: "whatsapp";
  user_data: MetaUserData;
  custom_data: MetaCustomData;
}

interface MetaCapiPayload {
  data: MetaEventData[];
}

interface BuildPayloadInput {
  eventName: string;
  eventTime: number;
  eventId: string;
  userData: MetaUserData;
  customData: MetaCustomData;
}

export function buildCapiPayload(input: BuildPayloadInput): MetaCapiPayload {
  return {
    data: [
      {
        event_name: input.eventName,
        event_time: input.eventTime,
        event_id: input.eventId,
        action_source: "business_messaging",
        messaging_channel: "whatsapp",
        user_data: input.userData,
        custom_data: input.customData,
      },
    ],
  };
}

interface SendEventInput {
  datasetId: string;
  accessToken: string;
  payload: MetaCapiPayload;
}

export async function sendEvent(input: SendEventInput): Promise<unknown> {
  const apiVersion = process.env.META_API_VERSION || "v21.0";
  const url = `https://graph.facebook.com/${apiVersion}/${input.datasetId}/events`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input.payload),
    signal: AbortSignal.timeout(8000),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      `Meta CAPI error (${response.status}): ${JSON.stringify(data)}`
    );
  }

  return data;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- __tests__/lib/meta-capi.test.ts
```

Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/meta-capi.ts __tests__/lib/meta-capi.test.ts
git commit -m "feat: add Meta Conversions API client for Business Messaging"
```

---

## Task 5: NextAuth Authentication

**Files:**
- Create: `src/lib/auth.ts`, `src/app/api/auth/[...nextauth]/route.ts`, `src/app/login/page.tsx`

- [ ] **Step 1: Write NextAuth config**

(bcryptjs already installed in Task 1)

Write `src/lib/auth.ts`:

```typescript
import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        });

        if (!user) return null;

        const isValid = await bcrypt.compare(
          credentials.password,
          user.passwordHash
        );

        if (!isValid) return null;

        return { id: user.id, email: user.email, name: user.name };
      },
    }),
  ],
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
};
```

- [ ] **Step 3: Create NextAuth route handler**

Write `src/app/api/auth/[...nextauth]/route.ts`:

```typescript
import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
```

- [ ] **Step 4: Create login page**

Write `src/app/login/page.tsx`:

```tsx
"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    if (result?.error) {
      setError("Email ou senha invalidos");
      setLoading(false);
    } else {
      router.push("/dashboard");
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950">
      <div className="w-full max-w-sm p-8 bg-gray-900 rounded-2xl border border-gray-800">
        <h1 className="text-2xl font-bold text-white mb-6 text-center">
          Blutracker
        </h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Senha</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
              required
            />
          </div>
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium disabled:opacity-50"
          >
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Create a seed script to create initial user**

Add to `package.json` scripts: `"seed": "ts-node prisma/seed.ts"`

Write `prisma/seed.ts`:

```typescript
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("admin123", 10);
  await prisma.user.upsert({
    where: { email: "admin@blutracker.com" },
    update: {},
    create: {
      email: "admin@blutracker.com",
      passwordHash,
      name: "Admin",
    },
  });
  console.log("Seed complete: admin@blutracker.com / admin123");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

- [ ] **Step 6: Run seed**

```bash
npx ts-node prisma/seed.ts
```

- [ ] **Step 7: Verify login works**

Start dev server, go to `/login`, enter `admin@blutracker.com` / `admin123`.
Expected: Redirects to `/dashboard`.

- [ ] **Step 8: Commit**

```bash
git add src/lib/auth.ts src/app/api/auth src/app/login prisma/seed.ts
git commit -m "feat: add NextAuth authentication with credentials provider"
```

---

## Task 6: Webhook Endpoint

**Files:**
- Create: `src/app/api/webhooks/bluvesales/route.ts`, `__tests__/api/webhooks.test.ts`

- [ ] **Step 1: Write failing tests**

Write `__tests__/api/webhooks.test.ts`:

```typescript
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
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 401 when secret is invalid", async () => {
    (prisma.whatsAppNumber.findUnique as jest.Mock).mockResolvedValue({
      id: "num-1",
      webhookSecret: "correct-secret",
      isActive: true,
    });
    const req = makeRequest(validPayload, "num-1", "wrong-secret");
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 400 when numberId is missing", async () => {
    const url = "http://localhost:3000/api/webhooks/bluvesales";
    const req = new Request(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Webhook-Secret": "s" },
      body: JSON.stringify(validPayload),
    });
    const res = await POST(req);
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
    const res = await POST(req);
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
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.status).toBe("duplicate");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- __tests__/api/webhooks.test.ts
```

Expected: FAIL

- [ ] **Step 3: Implement webhook endpoint**

Write `src/app/api/webhooks/bluvesales/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/encryption";
import { buildUserData } from "@/lib/hash";
import { buildCapiPayload, sendEvent } from "@/lib/meta-capi";

export async function POST(req: NextRequest) {
  try {
    // 1. Extract numberId and secret
    const numberId = req.nextUrl.searchParams.get("numberId");
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
    const body = await req.json();

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
        rawPayload: body,
      },
    });

    // 6. Use after() to keep serverless function alive after response
    after(() =>
      sendToMeta(event.id, number.accessToken, number.datasetId, body).catch(
        (err) => console.error(`Failed to send event ${event.id} to Meta:`, err)
      )
    );

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
  webhookBody: any
) {
  try {
    const accessToken = decrypt(encryptedToken);
    const { order, customer, product } = webhookBody;

    const userData = buildUserData({
      phone: customer.phone,
      email: customer.email,
      name: customer.name,
      document: customer.document,
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
        metaResponse: metaResponse as any,
        sentAt: new Date(),
      },
    });
  } catch (error: any) {
    await prisma.event.update({
      where: { id: eventId },
      data: {
        status: "FAILED",
        errorMessage: error.message,
        retryCount: { increment: 1 },
      },
    });
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- __tests__/api/webhooks.test.ts
```

Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/api/webhooks __tests__/api/webhooks.test.ts
git commit -m "feat: add webhook endpoint for Bluvesales with CAPI integration"
```

---

## Task 7: Cron Job for Retrying Failed Events

**Files:**
- Create: `src/app/api/cron/retry-events/route.ts`, `vercel.json`, `__tests__/api/retry-events.test.ts`

- [ ] **Step 1: Write failing test**

Write `__tests__/api/retry-events.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- __tests__/api/retry-events.test.ts
```

Expected: FAIL

- [ ] **Step 3: Implement cron route**

Write `src/app/api/cron/retry-events/route.ts`:

```typescript
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
```

- [ ] **Step 4: Create vercel.json for cron**

Write `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/retry-events",
      "schedule": "*/15 * * * *"
    }
  ]
}
```

Add `CRON_SECRET` to `.env.example`.

- [ ] **Step 5: Run tests to verify they pass**

```bash
npm test -- __tests__/api/retry-events.test.ts
```

Expected: All tests PASS

- [ ] **Step 6: Commit**

```bash
git add src/app/api/cron vercel.json __tests__/api/retry-events.test.ts
git commit -m "feat: add cron job for retrying failed CAPI events"
```

---

## Task 8: Numbers API (CRUD)

**Files:**
- Create: `src/app/api/numbers/route.ts`, `src/app/api/numbers/[id]/route.ts`

- [ ] **Step 1: Implement list + create route**

Write `src/app/api/numbers/route.ts`:

```typescript
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
```

- [ ] **Step 2: Implement single number route**

Write `src/app/api/numbers/[id]/route.ts`:

```typescript
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
```

- [ ] **Step 3: Verify manually — create a number via API**

```bash
curl -X POST http://localhost:3000/api/numbers \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","wabaId":"123","phoneNumberId":"456","accessToken":"tok","datasetId":"ds"}'
```

Expected: 201 with created number (or 401 if not authenticated — test via browser after login)

- [ ] **Step 4: Commit**

```bash
git add src/app/api/numbers
git commit -m "feat: add CRUD API for WhatsApp numbers"
```

---

## Task 9: Events API + Dashboard Stats API

**Files:**
- Create: `src/app/api/events/route.ts`, `src/app/api/events/[id]/retry/route.ts`, `src/app/api/dashboard/stats/route.ts`

- [ ] **Step 1: Implement events list with filters**

Write `src/app/api/events/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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

  const where: any = {};
  if (status) where.status = status;
  if (numberId) where.whatsappNumberId = numberId;
  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) where.createdAt.gte = new Date(startDate);
    if (endDate) where.createdAt.lte = new Date(endDate);
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
```

- [ ] **Step 2: Implement manual retry endpoint**

Write `src/app/api/events/[id]/retry/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const event = await prisma.event.findUnique({ where: { id: params.id } });
  if (!event) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.event.update({
    where: { id: params.id },
    data: { status: "PENDING", retryCount: 0, errorMessage: null },
  });

  return NextResponse.json({ status: "queued" });
}
```

- [ ] **Step 3: Implement dashboard stats endpoint**

Write `src/app/api/dashboard/stats/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const now = new Date();
  const today = new Date(now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  today.setHours(0, 0, 0, 0);

  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [
    todayEvents,
    weekEvents,
    monthEvents,
    totalValue,
    successRate,
    dailyEvents,
    eventsByNumber,
  ] = await Promise.all([
    prisma.event.count({ where: { createdAt: { gte: today } } }),
    prisma.event.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
    prisma.event.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
    prisma.event.aggregate({
      where: { status: "SENT", createdAt: { gte: thirtyDaysAgo } },
      _sum: { value: true },
    }),
    prisma.event.groupBy({
      by: ["status"],
      where: { createdAt: { gte: thirtyDaysAgo } },
      _count: true,
    }),
    prisma.$queryRaw`
      SELECT DATE(created_at AT TIME ZONE 'America/Sao_Paulo') as date,
             COUNT(*)::int as count
      FROM "Event"
      WHERE created_at >= ${thirtyDaysAgo}
      GROUP BY DATE(created_at AT TIME ZONE 'America/Sao_Paulo')
      ORDER BY date ASC
    `,
    prisma.event.groupBy({
      by: ["whatsappNumberId"],
      where: { createdAt: { gte: thirtyDaysAgo } },
      _count: true,
    }),
  ]);

  return NextResponse.json({
    cards: {
      today: todayEvents,
      week: weekEvents,
      month: monthEvents,
      totalValue: totalValue._sum.value || 0,
    },
    successRate,
    dailyEvents,
    eventsByNumber,
  });
}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/api/events src/app/api/dashboard
git commit -m "feat: add events API with filters, retry, and dashboard stats"
```

---

## Task 10: Install shadcn/ui + Layout Components

**Files:**
- Create: `src/app/layout.tsx`, `src/app/(authenticated)/layout.tsx`, `src/components/sidebar.tsx`

- [ ] **Step 1: Install shadcn/ui**

```bash
npx shadcn-ui@latest init
```

Select: TypeScript, Default style, Slate, CSS variables, `src/app/globals.css`, `@/components/ui`, `@/lib/utils`

- [ ] **Step 2: Add shadcn components**

```bash
npx shadcn-ui@latest add button card table badge dialog input label select tabs
```

- [ ] **Step 3: Install chart library**

```bash
npm install recharts
```

- [ ] **Step 4: Create SessionProvider wrapper**

Write `src/components/providers.tsx`:

```tsx
"use client";

import { SessionProvider } from "next-auth/react";

export function Providers({ children }: { children: React.ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
```

Update `src/app/layout.tsx` to wrap with Providers:

```tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Blutracker",
  description: "CAPI Business Messaging Platform",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" className="dark">
      <body className={`${inter.className} bg-gray-950`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

- [ ] **Step 5: Create sidebar component**

Write `src/components/sidebar.tsx`:

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: "📊" },
  { href: "/numbers", label: "Numeros", icon: "📱" },
  { href: "/events", label: "Eventos", icon: "📋" },
  { href: "/settings", label: "Configuracoes", icon: "⚙️" },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 min-h-screen bg-gray-900 border-r border-gray-800 flex flex-col">
      <div className="p-6">
        <h1 className="text-xl font-bold text-white">Blutracker</h1>
        <p className="text-xs text-gray-500 mt-1">CAPI Business Messaging</p>
      </div>
      <nav className="flex-1 px-3">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg mb-1 text-sm ${
                isActive
                  ? "bg-blue-600/20 text-blue-400"
                  : "text-gray-400 hover:text-white hover:bg-gray-800"
              }`}
            >
              <span>{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="p-3">
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="w-full px-3 py-2 text-sm text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg text-left"
        >
          Sair
        </button>
      </div>
    </aside>
  );
}
```

- [ ] **Step 5: Create authenticated layout**

Write `src/app/(authenticated)/layout.tsx`:

```tsx
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { Sidebar } from "@/components/sidebar";

export default async function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  return (
    <div className="flex min-h-screen bg-gray-950">
      <Sidebar />
      <main className="flex-1 p-8">{children}</main>
    </div>
  );
}
```

- [ ] **Step 6: Update root page to redirect**

Write `src/app/page.tsx`:

```tsx
import { redirect } from "next/navigation";

export default function Home() {
  redirect("/dashboard");
}
```

- [ ] **Step 7: Verify layout renders**

Start dev server, login, verify sidebar appears.

- [ ] **Step 8: Commit**

```bash
git add src/components/sidebar.tsx src/app/layout.tsx src/app/page.tsx src/app/"(authenticated)"
git commit -m "feat: add authenticated layout with sidebar navigation"
```

---

## Task 11: Dashboard Page

**Files:**
- Create: `src/app/(authenticated)/dashboard/page.tsx`, `src/components/stats-cards.tsx`, `src/components/events-chart.tsx`

- [ ] **Step 1: Create stats cards component**

Write `src/components/stats-cards.tsx`:

```tsx
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface StatsCardsProps {
  today: number;
  week: number;
  month: number;
  totalValue: number;
}

export function StatsCards({ today, week, month, totalValue }: StatsCardsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-gray-400">Hoje</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold text-white">{today}</p>
          <p className="text-xs text-gray-500">eventos</p>
        </CardContent>
      </Card>
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-gray-400">Ultimos 7 dias</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold text-white">{week}</p>
          <p className="text-xs text-gray-500">eventos</p>
        </CardContent>
      </Card>
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-gray-400">Ultimos 30 dias</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold text-white">{month}</p>
          <p className="text-xs text-gray-500">eventos</p>
        </CardContent>
      </Card>
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-gray-400">Vendas (30d)</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold text-green-400">
            R$ {totalValue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Create events chart component**

Write `src/components/events-chart.tsx`:

```tsx
"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface EventsChartProps {
  data: { date: string; count: number }[];
}

export function EventsChart({ data }: EventsChartProps) {
  return (
    <Card className="bg-gray-900 border-gray-800">
      <CardHeader>
        <CardTitle className="text-white">Eventos por dia</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis
              dataKey="date"
              stroke="#6b7280"
              fontSize={12}
              tickFormatter={(value) => {
                const d = new Date(value);
                return `${d.getDate()}/${d.getMonth() + 1}`;
              }}
            />
            <YAxis stroke="#6b7280" fontSize={12} />
            <Tooltip
              contentStyle={{
                backgroundColor: "#1f2937",
                border: "1px solid #374151",
                borderRadius: "8px",
              }}
              labelStyle={{ color: "#9ca3af" }}
            />
            <Line
              type="monotone"
              dataKey="count"
              stroke="#3b82f6"
              strokeWidth={2}
              dot={{ fill: "#3b82f6", r: 3 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 3: Create dashboard page**

Write `src/app/(authenticated)/dashboard/page.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { StatsCards } from "@/components/stats-cards";
import { EventsChart } from "@/components/events-chart";

interface DashboardData {
  cards: { today: number; week: number; month: number; totalValue: number };
  dailyEvents: { date: string; count: number }[];
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/dashboard/stats")
      .then((res) => res.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="text-gray-400">Carregando dashboard...</div>
    );
  }

  if (!data) return <div className="text-red-400">Erro ao carregar dados</div>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Dashboard</h1>
      <StatsCards
        today={data.cards.today}
        week={data.cards.week}
        month={data.cards.month}
        totalValue={data.cards.totalValue}
      />
      <EventsChart data={data.dailyEvents} />
    </div>
  );
}
```

- [ ] **Step 4: Verify dashboard renders**

Start dev server, login, navigate to `/dashboard`.
Expected: Cards and chart render (with zero data).

- [ ] **Step 5: Commit**

```bash
git add src/app/"(authenticated)"/dashboard src/components/stats-cards.tsx src/components/events-chart.tsx
git commit -m "feat: add dashboard page with stats cards and events chart"
```

---

## Task 12: Numbers Management Page

**Files:**
- Create: `src/app/(authenticated)/numbers/page.tsx`, `src/components/numbers-table.tsx`, `src/components/number-form-modal.tsx`

- [ ] **Step 1: Create number form modal**

Write `src/components/number-form-modal.tsx`:

```tsx
"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface NumberFormModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: any) => void;
  initialData?: any;
}

export function NumberFormModal({
  open,
  onClose,
  onSubmit,
  initialData,
}: NumberFormModalProps) {
  const [form, setForm] = useState(
    initialData || {
      name: "",
      wabaId: "",
      phoneNumberId: "",
      accessToken: "",
      datasetId: "",
    }
  );
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    await onSubmit(form);
    setLoading(false);
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-gray-900 border-gray-800">
        <DialogHeader>
          <DialogTitle className="text-white">
            {initialData ? "Editar Numero" : "Adicionar Numero"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label className="text-gray-400">Nome (apelido)</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="bg-gray-800 border-gray-700 text-white"
              placeholder="Ex: Reduza Principal"
              required
            />
          </div>
          <div>
            <Label className="text-gray-400">WABA ID</Label>
            <Input
              value={form.wabaId}
              onChange={(e) => setForm({ ...form, wabaId: e.target.value })}
              className="bg-gray-800 border-gray-700 text-white"
              required
            />
          </div>
          <div>
            <Label className="text-gray-400">Phone Number ID</Label>
            <Input
              value={form.phoneNumberId}
              onChange={(e) =>
                setForm({ ...form, phoneNumberId: e.target.value })
              }
              className="bg-gray-800 border-gray-700 text-white"
              required
            />
          </div>
          <div>
            <Label className="text-gray-400">Access Token</Label>
            <Input
              type="password"
              value={form.accessToken}
              onChange={(e) =>
                setForm({ ...form, accessToken: e.target.value })
              }
              className="bg-gray-800 border-gray-700 text-white"
              placeholder={initialData ? "Deixe vazio para manter atual" : ""}
              required={!initialData}
            />
          </div>
          <div>
            <Label className="text-gray-400">Dataset ID</Label>
            <Input
              value={form.datasetId}
              onChange={(e) => setForm({ ...form, datasetId: e.target.value })}
              className="bg-gray-800 border-gray-700 text-white"
              required
            />
          </div>
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Salvando..." : "Salvar"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Create numbers table component**

Write `src/components/numbers-table.tsx`:

```tsx
"use client";

import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface WhatsAppNumber {
  id: string;
  name: string;
  wabaId: string;
  phoneNumberId: string;
  datasetId: string;
  webhookSecret: string;
  isActive: boolean;
  _count: { events: number };
}

interface NumbersTableProps {
  numbers: WhatsAppNumber[];
  onEdit: (number: WhatsAppNumber) => void;
  onToggle: (id: string, isActive: boolean) => void;
  onDelete: (id: string) => void;
}

export function NumbersTable({
  numbers,
  onEdit,
  onToggle,
  onDelete,
}: NumbersTableProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  function copyWebhookUrl(number: WhatsAppNumber) {
    const baseUrl = window.location.origin;
    const url = `${baseUrl}/api/webhooks/bluvesales?numberId=${number.id}`;
    navigator.clipboard.writeText(url);
    setCopiedId(number.id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  return (
    <Table>
      <TableHeader>
        <TableRow className="border-gray-800">
          <TableHead className="text-gray-400">Nome</TableHead>
          <TableHead className="text-gray-400">WABA ID</TableHead>
          <TableHead className="text-gray-400">Dataset ID</TableHead>
          <TableHead className="text-gray-400">Eventos</TableHead>
          <TableHead className="text-gray-400">Status</TableHead>
          <TableHead className="text-gray-400">Webhook</TableHead>
          <TableHead className="text-gray-400">Acoes</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {numbers.map((num) => (
          <TableRow key={num.id} className="border-gray-800">
            <TableCell className="text-white font-medium">{num.name}</TableCell>
            <TableCell className="text-gray-400 font-mono text-xs">
              {num.wabaId}
            </TableCell>
            <TableCell className="text-gray-400 font-mono text-xs">
              {num.datasetId}
            </TableCell>
            <TableCell className="text-gray-400">
              {num._count.events}
            </TableCell>
            <TableCell>
              <Badge variant={num.isActive ? "default" : "secondary"}>
                {num.isActive ? "Ativo" : "Inativo"}
              </Badge>
            </TableCell>
            <TableCell>
              <Button
                variant="outline"
                size="sm"
                onClick={() => copyWebhookUrl(num)}
                className="text-xs"
              >
                {copiedId === num.id ? "Copiado!" : "Copiar URL"}
              </Button>
            </TableCell>
            <TableCell className="space-x-2">
              <Button variant="ghost" size="sm" onClick={() => onEdit(num)}>
                Editar
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onToggle(num.id, !num.isActive)}
              >
                {num.isActive ? "Desativar" : "Ativar"}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-red-400"
                onClick={() => onDelete(num.id)}
              >
                Excluir
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
```

- [ ] **Step 3: Create numbers page**

Write `src/app/(authenticated)/numbers/page.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { NumbersTable } from "@/components/numbers-table";
import { NumberFormModal } from "@/components/number-form-modal";

export default function NumbersPage() {
  const [numbers, setNumbers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingNumber, setEditingNumber] = useState<any>(null);

  async function loadNumbers() {
    const res = await fetch("/api/numbers");
    const data = await res.json();
    setNumbers(data);
    setLoading(false);
  }

  useEffect(() => {
    loadNumbers();
  }, []);

  async function handleCreate(data: any) {
    await fetch("/api/numbers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    loadNumbers();
  }

  async function handleEdit(data: any) {
    await fetch(`/api/numbers/${editingNumber.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    setEditingNumber(null);
    loadNumbers();
  }

  async function handleToggle(id: string, isActive: boolean) {
    await fetch(`/api/numbers/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive }),
    });
    loadNumbers();
  }

  async function handleDelete(id: string) {
    if (!confirm("Tem certeza que deseja excluir este numero?")) return;
    await fetch(`/api/numbers/${id}`, { method: "DELETE" });
    loadNumbers();
  }

  if (loading) return <div className="text-gray-400">Carregando...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Numeros WhatsApp</h1>
        <Button onClick={() => setModalOpen(true)}>Adicionar Numero</Button>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl">
        <NumbersTable
          numbers={numbers}
          onEdit={(num) => {
            setEditingNumber(num);
          }}
          onToggle={handleToggle}
          onDelete={handleDelete}
        />
      </div>

      <NumberFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={handleCreate}
      />

      {editingNumber && (
        <NumberFormModal
          open={true}
          onClose={() => setEditingNumber(null)}
          onSubmit={handleEdit}
          initialData={editingNumber}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 4: Verify numbers page works**

Start dev server, login, navigate to `/numbers`, add a number.
Expected: Number appears in table with webhook URL copy button.

- [ ] **Step 5: Commit**

```bash
git add src/app/"(authenticated)"/numbers src/components/numbers-table.tsx src/components/number-form-modal.tsx
git commit -m "feat: add WhatsApp numbers management page"
```

---

## Task 13: Events Log Page

**Files:**
- Create: `src/app/(authenticated)/events/page.tsx`, `src/components/events-table.tsx`, `src/components/event-detail-modal.tsx`

- [ ] **Step 1: Create event detail modal**

Write `src/components/event-detail-modal.tsx`:

```tsx
"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface EventDetailModalProps {
  open: boolean;
  onClose: () => void;
  event: any;
}

export function EventDetailModal({
  open,
  onClose,
  event,
}: EventDetailModalProps) {
  if (!event) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-gray-900 border-gray-800 max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-white">
            Evento {event.orderId}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-400">Status:</span>
              <span className="text-white ml-2">{event.status}</span>
            </div>
            <div>
              <span className="text-gray-400">Tipo:</span>
              <span className="text-white ml-2">{event.type}</span>
            </div>
            <div>
              <span className="text-gray-400">Cliente:</span>
              <span className="text-white ml-2">{event.customerName}</span>
            </div>
            <div>
              <span className="text-gray-400">Telefone:</span>
              <span className="text-white ml-2">{event.customerPhone}</span>
            </div>
            <div>
              <span className="text-gray-400">Produto:</span>
              <span className="text-white ml-2">{event.productName}</span>
            </div>
            <div>
              <span className="text-gray-400">Valor:</span>
              <span className="text-green-400 ml-2">
                R$ {Number(event.value).toFixed(2)}
              </span>
            </div>
            <div>
              <span className="text-gray-400">Tentativas:</span>
              <span className="text-white ml-2">{event.retryCount}</span>
            </div>
            <div>
              <span className="text-gray-400">Enviado em:</span>
              <span className="text-white ml-2">
                {event.sentAt
                  ? new Date(event.sentAt).toLocaleString("pt-BR")
                  : "—"}
              </span>
            </div>
          </div>

          {event.errorMessage && (
            <div>
              <p className="text-sm text-gray-400 mb-1">Erro:</p>
              <pre className="bg-gray-800 p-3 rounded text-xs text-red-400 overflow-x-auto">
                {event.errorMessage}
              </pre>
            </div>
          )}

          {event.metaResponse && (
            <div>
              <p className="text-sm text-gray-400 mb-1">Resposta Meta:</p>
              <pre className="bg-gray-800 p-3 rounded text-xs text-green-400 overflow-x-auto">
                {JSON.stringify(event.metaResponse, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Create events table component**

Write `src/components/events-table.tsx`:

```tsx
"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface EventsTableProps {
  events: any[];
  onViewDetail: (event: any) => void;
  onRetry: (id: string) => void;
}

const statusColors: Record<string, string> = {
  SENT: "default",
  FAILED: "destructive",
  PENDING: "secondary",
};

export function EventsTable({
  events,
  onViewDetail,
  onRetry,
}: EventsTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow className="border-gray-800">
          <TableHead className="text-gray-400">Data</TableHead>
          <TableHead className="text-gray-400">Numero</TableHead>
          <TableHead className="text-gray-400">Cliente</TableHead>
          <TableHead className="text-gray-400">Produto</TableHead>
          <TableHead className="text-gray-400">Valor</TableHead>
          <TableHead className="text-gray-400">Status</TableHead>
          <TableHead className="text-gray-400">Acoes</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {events.map((evt) => (
          <TableRow
            key={evt.id}
            className="border-gray-800 cursor-pointer hover:bg-gray-800/50"
            onClick={() => onViewDetail(evt)}
          >
            <TableCell className="text-gray-400 text-sm">
              {new Date(evt.createdAt).toLocaleString("pt-BR", {
                timeZone: "America/Sao_Paulo",
              })}
            </TableCell>
            <TableCell className="text-white">
              {evt.whatsappNumber?.name || "—"}
            </TableCell>
            <TableCell className="text-white">{evt.customerName}</TableCell>
            <TableCell className="text-gray-400">{evt.productName}</TableCell>
            <TableCell className="text-green-400">
              R$ {Number(evt.value).toFixed(2)}
            </TableCell>
            <TableCell>
              <Badge variant={statusColors[evt.status] as any}>
                {evt.status}
              </Badge>
            </TableCell>
            <TableCell>
              {evt.status === "FAILED" && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRetry(evt.id);
                  }}
                >
                  Reenviar
                </Button>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
```

- [ ] **Step 3: Create events page with filters**

Write `src/app/(authenticated)/events/page.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { EventsTable } from "@/components/events-table";
import { EventDetailModal } from "@/components/event-detail-modal";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function EventsPage() {
  const [events, setEvents] = useState<any[]>([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState<any>(null);
  const [numbers, setNumbers] = useState<any[]>([]);

  // Filters
  const [statusFilter, setStatusFilter] = useState("all");
  const [numberFilter, setNumberFilter] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  async function loadEvents(page = 1) {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: "20" });
    if (statusFilter && statusFilter !== "all") params.set("status", statusFilter);
    if (numberFilter && numberFilter !== "all") params.set("numberId", numberFilter);
    if (startDate) params.set("startDate", startDate);
    if (endDate) params.set("endDate", endDate);

    const res = await fetch(`/api/events?${params}`);
    const data = await res.json();
    setEvents(data.events);
    setPagination(data.pagination);
    setLoading(false);
  }

  async function loadNumbers() {
    const res = await fetch("/api/numbers");
    setNumbers(await res.json());
  }

  useEffect(() => {
    loadEvents();
    loadNumbers();
  }, []);

  async function handleRetry(id: string) {
    await fetch(`/api/events/${id}/retry`, { method: "POST" });
    loadEvents(pagination.page);
  }

  function applyFilters() {
    loadEvents(1);
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Eventos</h1>

      {/* Filters */}
      <div className="flex gap-3 items-end flex-wrap">
        <div>
          <label className="text-xs text-gray-400">Status</label>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-32 bg-gray-800 border-gray-700 text-white">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="SENT">SENT</SelectItem>
              <SelectItem value="FAILED">FAILED</SelectItem>
              <SelectItem value="PENDING">PENDING</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs text-gray-400">Numero</label>
          <Select value={numberFilter} onValueChange={setNumberFilter}>
            <SelectTrigger className="w-44 bg-gray-800 border-gray-700 text-white">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {numbers.map((n: any) => (
                <SelectItem key={n.id} value={n.id}>
                  {n.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs text-gray-400">De</label>
          <Input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="bg-gray-800 border-gray-700 text-white w-36"
          />
        </div>
        <div>
          <label className="text-xs text-gray-400">Ate</label>
          <Input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="bg-gray-800 border-gray-700 text-white w-36"
          />
        </div>
        <Button onClick={applyFilters}>Filtrar</Button>
      </div>

      {/* Table */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl">
        {loading ? (
          <div className="p-6 text-gray-400">Carregando...</div>
        ) : (
          <EventsTable
            events={events}
            onViewDetail={setSelectedEvent}
            onRetry={handleRetry}
          />
        )}
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between text-sm text-gray-400">
        <span>{pagination.total} eventos</span>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={pagination.page <= 1}
            onClick={() => loadEvents(pagination.page - 1)}
          >
            Anterior
          </Button>
          <span className="px-3 py-1">
            {pagination.page} / {pagination.totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={pagination.page >= pagination.totalPages}
            onClick={() => loadEvents(pagination.page + 1)}
          >
            Proximo
          </Button>
        </div>
      </div>

      <EventDetailModal
        open={!!selectedEvent}
        onClose={() => setSelectedEvent(null)}
        event={selectedEvent}
      />
    </div>
  );
}
```

- [ ] **Step 4: Verify events page renders**

Start dev server, login, navigate to `/events`.
Expected: Empty table with filters rendered.

- [ ] **Step 5: Commit**

```bash
git add src/app/"(authenticated)"/events src/components/events-table.tsx src/components/event-detail-modal.tsx
git commit -m "feat: add events log page with filters, pagination, and retry"
```

---

## Task 14: Settings Page

**Files:**
- Create: `src/app/(authenticated)/settings/page.tsx`

- [ ] **Step 1: Create settings page**

Write `src/app/(authenticated)/settings/page.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function SettingsPage() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    const res = await fetch("/api/auth/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword, newPassword }),
    });

    if (res.ok) {
      setMessage("Senha atualizada com sucesso!");
      setCurrentPassword("");
      setNewPassword("");
    } else {
      const data = await res.json();
      setMessage(data.error || "Erro ao atualizar senha");
    }
    setLoading(false);
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Configuracoes</h1>

      <Card className="bg-gray-900 border-gray-800 max-w-md">
        <CardHeader>
          <CardTitle className="text-white">Alterar Senha</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div>
              <Label className="text-gray-400">Senha Atual</Label>
              <Input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="bg-gray-800 border-gray-700 text-white"
                required
              />
            </div>
            <div>
              <Label className="text-gray-400">Nova Senha</Label>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="bg-gray-800 border-gray-700 text-white"
                required
              />
            </div>
            {message && (
              <p
                className={`text-sm ${
                  message.includes("sucesso")
                    ? "text-green-400"
                    : "text-red-400"
                }`}
              >
                {message}
              </p>
            )}
            <Button type="submit" disabled={loading}>
              {loading ? "Salvando..." : "Atualizar Senha"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Create change password API**

Write `src/app/api/auth/change-password/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { currentPassword, newPassword } = await req.json();

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!isValid) {
    return NextResponse.json({ error: "Senha atual incorreta" }, { status: 400 });
  }

  const newHash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: newHash },
  });

  return NextResponse.json({ status: "ok" });
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/"(authenticated)"/settings src/app/api/auth/change-password
git commit -m "feat: add settings page with password change"
```

---

## Task 15: End-to-End Verification

- [ ] **Step 1: Start the dev server**

```bash
npm run dev
```

- [ ] **Step 2: Login**

Go to `http://localhost:3000/login`, enter `admin@blutracker.com` / `admin123`.

- [ ] **Step 3: Add a WhatsApp number**

Navigate to `/numbers`, click "Adicionar Numero", fill in test data. Copy the webhook URL.

- [ ] **Step 4: Test the webhook with curl**

```bash
curl -X POST "http://localhost:3000/api/webhooks/bluvesales?numberId=YOUR_NUMBER_ID" \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Secret: YOUR_WEBHOOK_SECRET" \
  -d '{
    "event": "ORDER_CREATE",
    "order": {"id": "BLV-TEST-001", "internal_id": 1, "status": "cadastrados", "created_at": "2026-03-23T10:00:00-03:00"},
    "customer": {"name": "Teste Silva", "document": "123.456.789-00", "email": "teste@email.com", "phone": "11999999999", "address": {"street": "Rua Teste", "number": "1", "complement": null, "neighborhood": "Centro", "city": "Sao Paulo", "state": "SP", "zipcode": "01000-000", "country": "BR"}},
    "product": {"name": "Produto Teste", "plan": "Mensal", "price": 197.00},
    "seller": {"name": "Vendedor"}
  }'
```

Expected: `{"status":"received","eventId":"..."}`

- [ ] **Step 5: Verify event appears in dashboard**

Navigate to `/dashboard` — should show 1 event and R$ 197.00 in value.
Navigate to `/events` — should show the event with its status.

- [ ] **Step 6: Test duplicate rejection**

Run the same curl again. Expected: `{"status":"duplicate"}`

- [ ] **Step 7: Run all tests**

```bash
npm test
```

Expected: All tests pass.

- [ ] **Step 8: Final commit**

```bash
git add -A
git commit -m "chore: finalize Blutracker v1 with end-to-end verification"
```

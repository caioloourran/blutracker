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

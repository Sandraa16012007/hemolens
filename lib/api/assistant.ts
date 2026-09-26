/**
 * HemoLens — AI Assistant Chat API Client
 * Calls POST /api/chat on the FastAPI backend.
 *
 * The frontend NEVER crafts clinical guidance locally.
 * All conversational intelligence lives in the backend; this module is a thin HTTP bridge.
 */

export interface ChatReply {
  status: string;
  message: string;
  tips: string[];
  disclaimer: string;
  model: string;
  context_used: boolean;
  session_id: string;
}

export interface SendChatMessageInput {
  userId: string;
  sessionId: string;
  message: string;
}

export async function sendChatMessage({
  userId,
  sessionId,
  message,
}: SendChatMessageInput): Promise<ChatReply> {
  const backendBase = process.env.NEXT_PUBLIC_BACKEND_URL ?? "";
  const endpoint = backendBase ? `${backendBase}/api/chat` : "/api/chat";

  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: userId, session_id: sessionId, message }),
  });

  if (!response.ok) {
    let detail: {
      code?: string;
      message?: string;
      errors?: { code: string; message: string }[];
    } = {};
    try {
      const body = await response.json();
      detail = body?.detail ?? body ?? {};
    } catch {
      // non-JSON body — ignore
    }

    const msg =
      detail?.errors?.[0]?.message ??
      detail?.message ??
      `Backend returned ${response.status}`;

    throw new Error(msg);
  }

  const data = (await response.json()) as ChatReply;
  return data;
}

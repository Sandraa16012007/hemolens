/**
 * HemoLens — AI Assistant Chat API Client
 * Calls POST /api/chat on the FastAPI backend.
 *
 * The frontend NEVER crafts clinical guidance locally.
 * All conversational intelligence lives in the backend; this module is a thin HTTP bridge.
 */

import { createClient } from "@/lib/supabase/client";

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
  sessionId: string;
  message: string;
}

export interface ChatMemoryConversation {
  role: string;
  content: string;
  timestamp?: string;
}

export interface ChatMemory {
  profile_details: Record<string, unknown>;
  reports: Record<string, unknown>[];
  conversations: ChatMemoryConversation[];
  reports_count: number;
}

async function getAccessToken(): Promise<string | null> {
  const { data } = await createClient().auth.getSession();
  return data.session?.access_token ?? null;
}

export async function sendChatMessage({
  sessionId,
  message,
}: SendChatMessageInput): Promise<ChatReply> {
  const token = await getAccessToken();
  if (!token) {
    throw new Error("Please sign in to chat with HemoAI.");
  }

  const backendBase = process.env.NEXT_PUBLIC_BACKEND_URL ?? "";
  const endpoint = backendBase ? `${backendBase}/api/chat` : "/api/chat";

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ message, session_id: sessionId }),
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

export async function getChatMemory(): Promise<ChatMemory> {
  const token = await getAccessToken();
  if (!token) {
    throw new Error("Please sign in to chat with HemoAI.");
  }

  const backendBase = process.env.NEXT_PUBLIC_BACKEND_URL ?? "";
  const endpoint = backendBase
    ? `${backendBase}/api/chat/memory`
    : "/api/chat/memory";

  const response = await fetch(endpoint, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
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

  const data = (await response.json()) as ChatMemory;
  return data;
}

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { generateText, Output } from "ai";
import { z } from "zod";
import {
  createLovableAiGatewayProvider,
  requireLovableApiKey,
} from "./ai-gateway.server";

const CATEGORIES = [
  "groceries",
  "dining",
  "transport",
  "fuel",
  "utilities",
  "housing",
  "subscriptions",
  "health",
  "kids",
  "shopping",
  "entertainment",
  "travel",
  "gifts",
  "other",
] as const;

const ParsedExpense = z.object({
  amount: z.number(),
  category: z.enum(CATEGORIES),
  merchant: z.string().optional(),
  occurred_at: z.string().optional(),
  note: z.string().optional(),
});

const ParsedList = z.object({ items: z.array(ParsedExpense) });

function extractJson(text: string): unknown {
  const trimmed = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(trimmed.slice(start, end + 1));
    }
    throw new Error("AI response was not valid JSON: " + text.slice(0, 200));
  }
}

const CATEGORY_LIST = CATEGORIES.join(", ");

/** Parse a text memo into one or more structured expenses. */
export const parseMemo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ text: z.string().min(1).max(2000) }).parse(input),
  )
  .handler(async ({ data }) => {
    const gateway = createLovableAiGatewayProvider(requireLovableApiKey());
    const now = new Date().toISOString();

    const result = await generateText({
      model: gateway("google/gemini-3-flash-preview"),
      system: `You extract household expenses from short text memos in any language.
Current time: ${now}.
Currency is EUR. Amounts may be written as "12", "12€", "12 EUR", "12.50", "12,50".
Always return amount as positive number in EUR.
Pick the best matching category from this list: ${CATEGORY_LIST}.
If date is not given, use now (ISO 8601).
Multiple expenses in one memo => multiple items.

Respond ONLY with a JSON object of the shape:
{"items":[{"amount":number,"category":"<one of the list>","merchant"?:string,"occurred_at"?:string,"note"?:string}]}
No prose, no markdown fences.`,
      prompt: data.text,
    });
    const parsed = ParsedList.parse(extractJson(result.text));
    return parsed;
  });

/** Transcribe audio (base64 webm/mp4/wav) and parse to expenses. */
export const parseVoiceMemo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        audio_base64: z.string().min(10),
        mime_type: z.string().min(3),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const apiKey = requireLovableApiKey();

    // 1. Transcribe via OpenAI-compatible transcription endpoint
    const audioBytes = Uint8Array.from(atob(data.audio_base64), (c) => c.charCodeAt(0));
    const ext = data.mime_type.includes("webm")
      ? "webm"
      : data.mime_type.includes("mp4") || data.mime_type.includes("m4a")
      ? "m4a"
      : data.mime_type.includes("wav")
      ? "wav"
      : "webm";

    const form = new FormData();
    form.append(
      "file",
      new Blob([audioBytes], { type: data.mime_type }),
      `memo.${ext}`,
    );
    form.append("model", "openai/gpt-4o-mini-transcribe");

    const sttRes = await fetch("https://ai.gateway.lovable.dev/v1/audio/transcriptions", {
      method: "POST",
      headers: { "Lovable-API-Key": apiKey },
      body: form,
    });
    if (!sttRes.ok) {
      const errTxt = await sttRes.text();
      throw new Error(`Transcription failed (${sttRes.status}): ${errTxt}`);
    }
    const stt = (await sttRes.json()) as { text: string };
    const transcript = stt.text?.trim() ?? "";
    if (!transcript) return { transcript: "", items: [] };

    // 2. Reuse parseMemo logic inline
    const gateway = createLovableAiGatewayProvider(apiKey);
    const now = new Date().toISOString();
    const result = await generateText({
      model: gateway("google/gemini-3-flash-preview"),
      system: `You extract household expenses from voice memos in any language.
Current time: ${now}. Currency EUR. Always positive amounts.
Categories: ${CATEGORY_LIST}.

Respond ONLY with JSON: {"items":[{"amount":number,"category":"...","merchant"?:string,"occurred_at"?:string,"note"?:string}]}
No prose, no markdown fences.`,
      prompt: transcript,
    });
    const parsed = ParsedList.parse(extractJson(result.text));
    return { transcript, ...parsed };
  });

const StatementTx = z.object({
  amount: z.number(),
  category: z.enum(CATEGORIES),
  merchant: z.string().optional(),
  occurred_at: z.string().optional(),
  note: z.string().optional(),
});
const StatementList = z.object({ items: z.array(StatementTx) });

/** Parse a bank statement (PDF or CSV) into categorized expense rows. */
export const parseBankStatement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        file_base64: z.string().min(10),
        mime_type: z.string().min(3),
        file_name: z.string().min(1).max(200),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const apiKey = requireLovableApiKey();
    const gateway = createLovableAiGatewayProvider(apiKey);

    const isText = data.mime_type.includes("csv") || data.mime_type.includes("text");

    let userContent: Parameters<typeof generateText>[0]["messages"];

    if (isText) {
      const csvText = new TextDecoder().decode(
        Uint8Array.from(atob(data.file_base64), (c) => c.charCodeAt(0)),
      );
      userContent = [{ role: "user", content: `Parse this bank statement CSV:\n\n${csvText.slice(0, 80_000)}` }];
    } else {
      userContent = [
        {
          role: "user",
          content: [
            { type: "text", text: "Parse this bank statement and return all expense transactions." },
            {
              type: "file",
              data: `data:${data.mime_type};base64,${data.file_base64}`,
              mediaType: data.mime_type,
            },
          ],
        },
      ];
    }

    const result = await generateText({
      model: gateway("google/gemini-3-flash-preview"),
      system: `You extract expense transactions from bank statements.
Currency is EUR. Return only debits/expenses (skip incoming credits and transfers in).
Always positive amounts. Categorize using one of: ${CATEGORY_LIST}.
Use the transaction date in ISO 8601 format.

Respond ONLY with JSON: {"items":[{"amount":number,"category":"...","merchant"?:string,"occurred_at"?:string,"note"?:string}]}
No prose, no markdown fences.`,
      messages: userContent,
    });

    return StatementList.parse(extractJson(result.text));
  });

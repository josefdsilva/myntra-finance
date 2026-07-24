import { createServerFn } from "@tanstack/react-start";
import { createHash } from "node:crypto";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { generateText } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider, requireLovableApiKey } from "./ai-gateway.server";
import {
  estimateTextCredits,
  estimateTranscribeCredits,
  logHouseholdCredits,
} from "./credits.server";

const PARSE_MODEL = "google/gemini-3-flash-preview";

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
  const trimmed = text
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/, "")
    .trim();
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
    z
      .object({
        text: z.string().min(1).max(2000),
        householdId: z.string().uuid().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const gateway = createLovableAiGatewayProvider(requireLovableApiKey());
    const now = new Date().toISOString();

    const result = await generateText({
      model: gateway(PARSE_MODEL),
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
    if (data.householdId) {
      const est = estimateTextCredits(PARSE_MODEL, result.usage as never);
      await logHouseholdCredits({
        householdId: data.householdId,
        userId: context.userId,
        operation: "ai_parse_memo",
        credits: est.credits,
        inputTokens: est.input,
        outputTokens: est.output,
      });
    }
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
        householdId: z.string().uuid().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
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
    form.append("file", new Blob([audioBytes], { type: data.mime_type }), `memo.${ext}`);
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
      model: gateway(PARSE_MODEL),
      system: `You extract household expenses from voice memos in any language.
Current time: ${now}. Currency EUR. Always positive amounts.
Categories: ${CATEGORY_LIST}.

Respond ONLY with JSON: {"items":[{"amount":number,"category":"...","merchant"?:string,"occurred_at"?:string,"note"?:string}]}
No prose, no markdown fences.`,
      prompt: transcript,
    });
    const parsed = ParsedList.parse(extractJson(result.text));
    if (data.householdId) {
      const est = estimateTextCredits(PARSE_MODEL, result.usage as never);
      const trs = estimateTranscribeCredits();
      await logHouseholdCredits({
        householdId: data.householdId,
        userId: context.userId,
        operation: "ai_parse_voice",
        credits: est.credits + trs.credits,
        inputTokens: est.input,
        outputTokens: est.output,
        meta: { mime_type: data.mime_type },
      });
    }
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
        householdId: z.string().uuid().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const apiKey = requireLovableApiKey();
    const gateway = createLovableAiGatewayProvider(apiKey);

    const isText = data.mime_type.includes("csv") || data.mime_type.includes("text");

    let userContent: Parameters<typeof generateText>[0]["messages"];

    if (isText) {
      const csvText = new TextDecoder().decode(
        Uint8Array.from(atob(data.file_base64), (c) => c.charCodeAt(0)),
      );
      userContent = [
        { role: "user", content: `Parse this bank statement CSV:\n\n${csvText.slice(0, 80_000)}` },
      ];
    } else {
      userContent = [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Parse this bank statement and return all expense transactions.",
            },
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
      model: gateway(PARSE_MODEL),
      system: `You extract expense transactions from bank statements.
Currency is EUR. Return only debits/expenses (skip incoming credits and transfers in).
Always positive amounts. Categorize using one of: ${CATEGORY_LIST}.
Use the transaction date in ISO 8601 format.

Respond with minified JSON on a single line, no extra whitespace: {"items":[{"amount":number,"category":"...","merchant"?:string,"occurred_at"?:string,"note"?:string}]}
Do not repeat the input. No prose, no markdown fences.`,
      messages: userContent,
    });

    if (data.householdId) {
      const est = estimateTextCredits(PARSE_MODEL, result.usage as never);
      await logHouseholdCredits({
        householdId: data.householdId,
        userId: context.userId,
        operation: "ai_parse_statement",
        credits: est.credits,
        inputTokens: est.input,
        outputTokens: est.output,
        meta: { file_name: data.file_name, mime_type: data.mime_type },
      });
    }

    return StatementList.parse(extractJson(result.text));
  });

const ExtractedTxn = z.object({
  date: z.string().min(4).max(40),
  description: z.string().max(300),
  // Signed: negative = money out (debit), positive = money in (credit).
  amount: z.number(),
});
const ExtractedList = z.object({ items: z.array(ExtractedTxn) });

/**
 * Read a bank/card statement (PDF or CSV, any bank/country/language) and return
 * a normalized, SIGNED transaction list. This deliberately does no analysis and
 * no categorization — it only turns a messy file into clean rows, which the
 * deterministic engine (analyzeStatement) then turns into fixed/variable/income/
 * debt candidates. Keeping the AI to the parsing step is what makes a new bank
 * "just work" without new per-bank code, while the budget math stays stable.
 */
export const extractStatementTransactions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        file_base64: z.string().min(10),
        mime_type: z.string().min(3),
        file_name: z.string().min(1).max(200),
        householdId: z.string().uuid().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const fileHash = createHash("sha256").update(data.file_base64).digest("hex");

    // Reuse a prior extraction of the identical file: free, and deterministic
    // for a retry after a failed import.
    if (data.householdId) {
      const { data: cached } = await context.supabase
        .from("ai_extraction_cache")
        .select("result")
        .eq("household_id", data.householdId)
        .eq("file_hash", fileHash)
        .maybeSingle();
      if (cached?.result) {
        const hit = ExtractedList.safeParse(cached.result);
        if (hit.success) return hit.data;
      }
    }

    const apiKey = requireLovableApiKey();
    const gateway = createLovableAiGatewayProvider(apiKey);

    const isText = data.mime_type.includes("csv") || data.mime_type.includes("text");
    let messages: Parameters<typeof generateText>[0]["messages"];
    if (isText) {
      const csvText = new TextDecoder().decode(
        Uint8Array.from(atob(data.file_base64), (c) => c.charCodeAt(0)),
      );
      messages = [
        { role: "user", content: `Extract every transaction from this statement:\n\n${csvText.slice(0, 120_000)}` },
      ];
    } else {
      messages = [
        {
          role: "user",
          content: [
            { type: "text", text: "Extract every transaction from this bank statement." },
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
      model: gateway(PARSE_MODEL),
      system: `You read bank and card statements from any bank, country, or language, given as CSV text or a PDF.
Extract EVERY transaction line. For each one return:
- "date": the transaction (booking) date as ISO "yyyy-mm-dd". If only day/month is shown, infer the year from the statement.
- "description": the raw merchant or description text, kept verbatim. Do not translate or clean it.
- "amount": a SIGNED number. NEGATIVE for money leaving the account (debits, purchases, withdrawals, fees, direct debits). POSITIVE for money coming in (salary, credits, refunds, transfers in).
Rules: include BOTH debits and credits. Do not categorize. Do not summarize or merge lines. Ignore running-balance columns and any header, footer, or summary totals. Use a dot as the decimal separator.
Respond with minified JSON on a single line, no extra whitespace, of shape {"items":[{"date":"yyyy-mm-dd","description":string,"amount":number}]}. Do not repeat the input. No prose, no markdown fences.`,
      messages,
    });

    const parsed = ExtractedList.parse(extractJson(result.text));

    if (data.householdId) {
      const est = estimateTextCredits(PARSE_MODEL, result.usage as never);
      await logHouseholdCredits({
        householdId: data.householdId,
        userId: context.userId,
        operation: "ai_extract_statement",
        credits: est.credits,
        inputTokens: est.input,
        outputTokens: est.output,
        meta: { file_name: data.file_name, mime_type: data.mime_type },
      });
      // Cache so a re-upload of the identical file is free.
      await context.supabase.from("ai_extraction_cache").upsert(
        { household_id: data.householdId, file_hash: fileHash, result: parsed },
        { onConflict: "household_id,file_hash" },
      );
    }

    return parsed;
  });

/** Parse a photo of a receipt / bill into one or more expense rows. */
export const parseReceiptPhoto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        image_base64: z.string().min(10),
        mime_type: z.string().min(3),
        householdId: z.string().uuid().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const apiKey = requireLovableApiKey();
    const gateway = createLovableAiGatewayProvider(apiKey);
    const now = new Date().toISOString();

    // Images go through as an image part; PDFs (a scanned/exported invoice)
    // through as a document/file part, which the model reads natively.
    const dataUrl = `data:${data.mime_type};base64,${data.image_base64}`;
    const filePart = data.mime_type.includes("pdf")
      ? ({ type: "file", data: dataUrl, mediaType: data.mime_type } as const)
      : ({ type: "image", image: dataUrl } as const);

    const result = await generateText({
      model: gateway(PARSE_MODEL),
      system: `You extract expense line items from a receipt, bill, or invoice (a photo or a PDF).
Current time: ${now}. Currency EUR. Always positive amounts.
Prefer ONE row with the document total when it is from a single merchant;
only split into multiple rows when it clearly covers different categories
(e.g. groceries + fuel on the same ticket).
Pick the best matching category from: ${CATEGORY_LIST}.
Use the receipt/invoice date in ISO 8601 when visible, otherwise use now.
Merchant = shop / issuer name on the document.

Respond ONLY with JSON: {"items":[{"amount":number,"category":"...","merchant"?:string,"occurred_at"?:string,"note"?:string}]}
No prose, no markdown fences.`,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "Extract the expense(s) from this receipt, bill, or invoice." },
            filePart,
          ],
        },
      ],
    });

    const parsed = ParsedList.parse(extractJson(result.text));
    if (data.householdId) {
      const est = estimateTextCredits(PARSE_MODEL, result.usage as never);
      await logHouseholdCredits({
        householdId: data.householdId,
        userId: context.userId,
        operation: "ai_parse_photo",
        credits: est.credits,
        inputTokens: est.input,
        outputTokens: est.output,
        meta: { mime_type: data.mime_type },
      });
    }
    return parsed;
  });

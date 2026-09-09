const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";

export type OpenAIResponse = {
  output_text?: string;
  output?: Array<{ content?: Array<{ type?: string; text?: string }> }>;
  error?: { message?: string };
};

export function readResponseText(response: OpenAIResponse) {
  if (response.output_text?.trim()) return response.output_text.trim();
  return (response.output ?? [])
    .flatMap((item) => item.content ?? [])
    .filter((content) => content.type === "output_text" && content.text)
    .map((content) => content.text?.trim())
    .filter(Boolean)
    .join("\n\n");
}

export async function askAccountingAssistant(question: string) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OpenAI is not configured. Add OPENAI_API_KEY to the server environment.");

  const response = await fetch(OPENAI_RESPONSES_URL, {
    method: "POST",
    headers: { Authorization: "Bearer " + apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-5-mini",
      instructions: "You are the assistant inside King's Accounting Software. Give concise, practical bookkeeping and trucking-operations guidance. Never claim to be a CPA, file taxes, move money, or modify records. Clearly recommend professional review for legal, tax, payroll, or compliance decisions. Do not invent business data that was not supplied by the user.",
      input: question,
      max_output_tokens: 700,
    }),
  });

  const data = (await response.json()) as OpenAIResponse;
  if (!response.ok) throw new Error(data.error?.message || "OpenAI could not complete the request.");
  const answer = readResponseText(data);
  if (!answer) throw new Error("OpenAI returned an empty response.");
  return answer;
}

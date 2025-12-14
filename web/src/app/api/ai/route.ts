import { NextResponse } from "next/server";

/**
 * Stub for /api/ai – future AI integration endpoint.
 * Could call OpenAI, Azure OpenAI, or a local model.
 *
 * Example use cases:
 * - Generate summaries of F-grade patterns
 * - Suggest interventions for at-risk students
 * - Natural-language Q&A over grade data
 */

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { prompt } = body as { prompt?: string };

    if (!prompt) {
      return NextResponse.json({ error: "Missing 'prompt' in request body" }, { status: 400 });
    }

    // TODO: Call AI service
    return NextResponse.json({
      message: "AI endpoint not implemented yet",
      receivedPrompt: prompt,
    }, { status: 501 });
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
}


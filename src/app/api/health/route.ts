import { NextResponse } from "next/server";

/**
 * Simple health-check endpoint.
 * Used by uptime monitors and to verify the Next.js API layer is running.
 */
export async function GET() {
  return NextResponse.json({ status: "ok", timestamp: new Date().toISOString() });
}


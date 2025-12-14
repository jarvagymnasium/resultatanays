import { NextResponse } from "next/server";

/**
 * Stub for /api/students – future backend-to-backend route
 * that will proxy or aggregate data from your elevdatabas API.
 *
 * When implementing, use environment variables for API URL & key,
 * and add authentication middleware as needed.
 */

export async function GET() {
  // TODO: Replace with real elevdatabas API call
  return NextResponse.json({
    message: "Not implemented yet",
    hint: "Implement this route to fetch student data from your elevdatabas API",
  }, { status: 501 });
}


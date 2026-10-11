import { createWaitlistHandlers, waitlistConfig } from "@/lib/waitlist-server";

export const runtime = "nodejs";

export function GET() {
  return createWaitlistHandlers(waitlistConfig(process.env)).GET();
}

export function POST(request: Request) {
  return createWaitlistHandlers(waitlistConfig(process.env)).POST(request);
}

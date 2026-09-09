import { NextResponse, type NextRequest } from "next/server";

import { deletePlatformSessionByToken, PLATFORM_SESSION_COOKIE_NAME } from "@/lib/auth/platform-session";
import { requestOrigin } from "@/lib/http/request-origin";

export async function POST(request: NextRequest) {
  const token = request.cookies.get(PLATFORM_SESSION_COOKIE_NAME)?.value;
  if (token) {
    await deletePlatformSessionByToken(token);
  }

  const response = NextResponse.redirect(new URL("/platform/login", requestOrigin(request)), {
    status: 303,
  });
  response.cookies.delete(PLATFORM_SESSION_COOKIE_NAME);
  return response;
}

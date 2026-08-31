import { NextResponse, type NextRequest } from "next/server";

import { deleteSessionByToken, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { requestOrigin } from "@/lib/http/request-origin";

export async function POST(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (token) {
    await deleteSessionByToken(token);
  }

  const response = NextResponse.redirect(new URL("/login", requestOrigin(request)), {
    status: 303,
  });
  response.cookies.delete(SESSION_COOKIE_NAME);
  return response;
}

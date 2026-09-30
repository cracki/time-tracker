/** POST /api/auth/logout — destroys the session and clears the cookie. */

import { NextResponse } from "next/server";
import { handle } from "@/lib/server/api-helpers";
import { SESSION_COOKIE, destroySession } from "@/lib/server/auth";

export async function POST() {
  return handle(async () => {
    await destroySession();
    const res = NextResponse.json({ ok: true });
    res.cookies.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
    return res;
  });
}

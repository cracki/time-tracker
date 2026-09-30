/** GET /api/auth/me — current session user (null-safe 401 for the client gate). */

import { NextResponse } from "next/server";
import { handle } from "@/lib/server/api-helpers";
import { getSessionUser } from "@/lib/server/auth";

export async function GET() {
  return handle(async () => {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "وارد نشده‌اید.", code: "unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ user });
  });
}

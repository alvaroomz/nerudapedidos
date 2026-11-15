import { NextResponse } from "next/server";
import { createSessionToken, safeStringEqual, SESSION_COOKIE } from "../../../../lib/admin-auth";

export const runtime = "nodejs";

export async function POST(request) {
  try {
    const { password } = await request.json();
    const expected = process.env.ADMIN_PASSWORD;
    if (!expected) {
      return NextResponse.json({ error: "Falta configurar ADMIN_PASSWORD en Vercel." }, { status: 500 });
    }
    if (!safeStringEqual(password, expected)) {
      return NextResponse.json({ error: "Contraseña incorrecta." }, { status: 401 });
    }
    const response = NextResponse.json({ ok: true });
    response.cookies.set(SESSION_COOKIE, createSessionToken(), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 8 * 60 * 60
    });
    return response;
  } catch (error) {
    return NextResponse.json({ error: error.message || "No se pudo iniciar sesión." }, { status: 500 });
  }
}

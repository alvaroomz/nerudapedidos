import { NextResponse } from "next/server";
import { getSql } from "../../../../lib/db";
import { corsJson, corsOptions } from "../../../../lib/cors";

export const runtime = "nodejs";

export async function GET(request) {
  try {
    const slug = new URL(request.url).searchParams.get("restaurant");
    if (!slug) return corsJson(request, { error: "Falta el identificador del restaurante." }, { status: 400 });
    const sql = getSql();
    const rows = await sql`
      SELECT slug, name, whatsapp_number
      FROM restaurants
      WHERE slug = ${slug} AND active = TRUE
      LIMIT 1
    `;
    if (!rows.length) return corsJson(request, { error: "Restaurante no encontrado." }, { status: 404 });
    return corsJson(request, { restaurant: rows[0] }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return corsJson(request, { error: error.message || "No se pudo cargar la configuración." }, { status: 500 });
  }
}

export function OPTIONS(request) { return corsOptions(request); }

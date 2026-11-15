import { NextResponse } from "next/server";
import { getSql } from "../../../../../lib/db";
import { isAdminRequest } from "../../../../../lib/admin-auth";

export const runtime = "nodejs";
const VALID_STATUSES = new Set(["new", "accepted", "preparing", "on_the_way", "completed", "cancelled"]);

export async function PATCH(request, context) {
  if (!isAdminRequest(request)) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  try {
    const { id } = await context.params;
    const { status } = await request.json();
    if (!VALID_STATUSES.has(status)) return NextResponse.json({ error: "Estado no válido." }, { status: 400 });
    const sql = getSql();
    const restaurantSlug = process.env.RESTAURANT_SLUG || "cafe-neruda";
    const rows = await sql`
      UPDATE orders
      SET status = ${status}, updated_at = NOW()
      WHERE order_number = ${id}
        AND restaurant_id = (SELECT id FROM restaurants WHERE slug = ${restaurantSlug})
      RETURNING *
    `;
    if (!rows.length) return NextResponse.json({ error: "Pedido no encontrado." }, { status: 404 });
    return NextResponse.json({ ok: true, order: rows[0] });
  } catch (error) {
    return NextResponse.json({ error: error.message || "No se pudo actualizar el estado." }, { status: 500 });
  }
}

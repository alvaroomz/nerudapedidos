import { NextResponse } from "next/server";
import { getSql } from "../../../lib/db";
import { isAdminRequest } from "../../../lib/admin-auth";
import { corsJson, corsOptions } from "../../../lib/cors";

export const runtime = "nodejs";

function digits(value) {
  return String(value || "").replace(/\D/g, "");
}

function normalizeMexicoPhone(value) {
  const raw = digits(value);
  if (raw.length === 10) return `52${raw}`;
  if (raw.length === 12 && raw.startsWith("52")) return raw;
  if (raw.length === 13 && raw.startsWith("521")) return `52${raw.slice(3)}`;
  return raw;
}

function validPhone(value) {
  const valueDigits = digits(value);
  return valueDigits.length === 10 || (valueDigits.length === 12 && valueDigits.startsWith("52")) || (valueDigits.length === 13 && valueDigits.startsWith("521"));
}

function buildWhatsAppText(order, items, restaurantName) {
  const lines = items.map((item) => `• ${item.quantity} × ${item.name} — $${Number(item.lineTotal).toFixed(2)} MXN`);
  return [
    `PEDIDO A DOMICILIO · ${restaurantName}`,
    `Pedido #${order.order_number}`,
    "",
    "PRODUCTOS:",
    ...lines,
    "",
    `Subtotal: $${Number(order.subtotal).toFixed(2)} MXN`,
    "Envío: por confirmar con el restaurante",
    `Nombre: ${order.customer_name}`,
    `Teléfono: ${order.customer_phone}`,
    `Dirección: ${order.delivery_address}`,
    `Ubicación: ${order.location_url || "No compartida"}`,
    `Referencias: ${order.delivery_references || "Sin referencias"}`,
    `Pago: ${order.payment_method}`,
    `Cambio: ${order.cash_change_for || "No aplica"}`,
    `Notas: ${order.notes || "Ninguna"}`,
    "",
    "Favor de confirmar disponibilidad, costo de envío y total final."
  ].join("\n");
}

export async function GET(request) {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  try {
    const sql = getSql();
    const restaurantSlug = process.env.RESTAURANT_SLUG || "cafe-neruda";
    const rows = await sql`
      SELECT o.*,
        r.name AS restaurant_name
      FROM orders o
      JOIN restaurants r ON r.id = o.restaurant_id
      WHERE r.slug = ${restaurantSlug}
      ORDER BY o.created_at DESC
      LIMIT 300
    `;
    return NextResponse.json({ orders: rows }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error.message || "No se pudieron consultar los pedidos." }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const {
      restaurantSlug, type, customerName, phone, address, locationUrl,
      references, paymentMethod, cashChangeFor, notes, tableNumber, items
    } = body || {};

    const configuredSlug = process.env.RESTAURANT_SLUG || "cafe-neruda";
    if (!restaurantSlug || restaurantSlug !== configuredSlug || !["delivery", "dine_in"].includes(type)) {
      return corsJson(request, { error: "Restaurante o tipo de pedido no válido para este panel." }, { status: 400 });
    }
    if (!Array.isArray(items) || items.length < 1 || items.length > 30) {
      return corsJson(request, { error: "Agrega al menos un producto al pedido." }, { status: 400 });
    }
    if (!String(customerName || "").trim()) {
      return corsJson(request, { error: "Escribe el nombre de quien realiza el pedido." }, { status: 400 });
    }
    if (type === "delivery") {
      if (!validPhone(phone)) return corsJson(request, { error: "Escribe un teléfono de contacto válido." }, { status: 400 });
      if (!String(address || "").trim()) return corsJson(request, { error: "La dirección de entrega es obligatoria." }, { status: 400 });
      if (!String(paymentMethod || "").trim()) return corsJson(request, { error: "Selecciona un método de pago." }, { status: 400 });
    } else {
      if (!String(tableNumber || "").trim()) return corsJson(request, { error: "Indica el número de mesa." }, { status: 400 });
      if (!String(paymentMethod || "").trim()) return corsJson(request, { error: "Selecciona una forma de pago." }, { status: 400 });
    }

    const sql = getSql();
    const restaurants = await sql`
      SELECT id, name, whatsapp_number
      FROM restaurants
      WHERE slug = ${restaurantSlug} AND active = TRUE
      LIMIT 1
    `;
    if (!restaurants.length) return corsJson(request, { error: "El restaurante no está configurado." }, { status: 404 });
    const restaurant = restaurants[0];
    if (type === "delivery" && !validPhone(restaurant.whatsapp_number)) {
      return corsJson(request, { error: "Configura el número de WhatsApp de Café Neruda en la tabla restaurants antes de recibir pedidos a domicilio." }, { status: 500 });
    }

    // El servidor consulta los precios reales en la base de datos; no confía en los precios enviados por el navegador.
    const validatedItems = [];
    for (const requested of items) {
      const code = String(requested.code || "").trim();
      const quantity = Number(requested.quantity);
      if (!code || !Number.isInteger(quantity) || quantity < 1 || quantity > 30) {
        return corsJson(request, { error: "Hay un producto o cantidad no válida." }, { status: 400 });
      }
      const productRows = await sql`
        SELECT code, name, price
        FROM menu_items
        WHERE restaurant_id = ${restaurant.id} AND code = ${code} AND active = TRUE
        LIMIT 1
      `;
      if (!productRows.length) {
        return corsJson(request, { error: `El producto ${code} no está disponible. Revisa la configuración del menú.` }, { status: 400 });
      }
      const product = productRows[0];
      const unitPrice = Number(product.price);
      validatedItems.push({
        code: product.code,
        name: product.name,
        quantity,
        unitPrice,
        lineTotal: Number((unitPrice * quantity).toFixed(2))
      });
    }

    const subtotal = Number(validatedItems.reduce((sum, item) => sum + item.lineTotal, 0).toFixed(2));
    const customerPhone = type === "delivery" ? normalizeMexicoPhone(phone) : (phone ? normalizeMexicoPhone(phone) : null);
    const payment = String(paymentMethod || "Pago en restaurante").trim();
    const inserted = await sql`
      INSERT INTO orders (
        restaurant_id, order_type, status, customer_name, customer_phone,
        delivery_address, location_url, delivery_references, table_number,
        payment_method, cash_change_for, notes, items, subtotal, delivery_fee, total
      ) VALUES (
        ${restaurant.id}, ${type}, 'new', ${String(customerName).trim()}, ${customerPhone},
        ${type === "delivery" ? String(address).trim() : null},
        ${type === "delivery" ? (String(locationUrl || "").trim() || null) : null},
        ${type === "delivery" ? (String(references || "").trim() || null) : null},
        ${type === "dine_in" ? String(tableNumber).trim() : null},
        ${payment}, ${type === "delivery" ? (String(cashChangeFor || "").trim() || null) : null},
        ${String(notes || "").trim() || null}, ${JSON.stringify(validatedItems)}::jsonb,
        ${subtotal}, 0, ${subtotal}
      )
      RETURNING order_number, order_type, status, customer_name, customer_phone,
                delivery_address, location_url, delivery_references, table_number,
                payment_method, cash_change_for, notes, items, subtotal, total, created_at
    `;
    const order = inserted[0];
    const whatsappNumber = normalizeMexicoPhone(restaurant.whatsapp_number);
    const whatsappText = type === "delivery" ? buildWhatsAppText(order, validatedItems, restaurant.name) : null;

    return corsJson(request, {
      ok: true,
      order,
      restaurantName: restaurant.name,
      whatsappNumber: type === "delivery" ? whatsappNumber : null,
      whatsappText
    }, { status: 201 });
  } catch (error) {
    return corsJson(request, { error: error.message || "No se pudo registrar el pedido." }, { status: 500 });
  }
}

export function OPTIONS(request) { return corsOptions(request); }

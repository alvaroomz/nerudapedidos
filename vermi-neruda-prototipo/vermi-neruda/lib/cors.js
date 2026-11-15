import { NextResponse } from "next/server";

export function getCorsHeaders(request) {
  const origin = request.headers.get("origin");
  const allowed = (process.env.MENU_ORIGIN || "https://neruda.vermiplato.com")
    .split(",").map((item) => item.trim()).filter(Boolean);
  const headers = {
    "Vary": "Origin",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };
  if (origin && allowed.includes(origin)) headers["Access-Control-Allow-Origin"] = origin;
  return headers;
}

export function corsJson(request, data, options = {}) {
  return NextResponse.json(data, {
    ...options,
    headers: { ...getCorsHeaders(request), ...(options.headers || {}) }
  });
}

export function corsOptions(request) {
  return new NextResponse(null, { status: 204, headers: getCorsHeaders(request) });
}

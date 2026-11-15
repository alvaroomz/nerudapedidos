"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

const STATUS = {
  new: { label: "Nuevo", color: "green" },
  accepted: { label: "Pedido tomado", color: "blue" },
  preparing: { label: "En preparación", color: "amber" },
  on_the_way: { label: "En camino", color: "purple" },
  completed: { label: "Entregado", color: "gray" },
  cancelled: { label: "Cancelado", color: "red" }
};
const TYPE_LABEL = { delivery: "A domicilio", dine_in: "Restaurante" };
const STATUS_MESSAGE = {
  accepted: "¡Hola! Tu pedido #{number} de Café Neruda ha sido tomado por el restaurante. Pronto comenzaremos a prepararlo.",
  preparing: "¡Hola! Tu pedido #{number} de Café Neruda ya está en preparación. ¡Gracias por tu preferencia!",
  on_the_way: "¡Hola! Tu pedido #{number} de Café Neruda va en camino. ¡Gracias por tu preferencia!",
  completed: "¡Hola! Tu pedido #{number} de Café Neruda aparece como entregado. ¡Gracias por tu compra!",
  cancelled: "Hola. Tenemos una actualización sobre tu pedido #{number} de Café Neruda. Comunícate con el restaurante para más información."
};
const money = (value) => new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(Number(value || 0));
const phoneForWhatsApp = (value) => {
  let digits = String(value || "").replace(/\D/g, "");
  if (digits.length === 10) digits = `52${digits}`;
  else if (digits.length === 13 && digits.startsWith("521")) digits = `52${digits.slice(3)}`;
  return digits;
};

export default function PedidosPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loggedIn, setLoggedIn] = useState(false);
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [updating, setUpdating] = useState(null);
  const [notice, setNotice] = useState("");
  const [noticeLink, setNoticeLink] = useState("");

  const loadOrders = useCallback(async () => {
    try {
      const response = await fetch("/api/orders", { cache: "no-store" });
      if (response.status === 401) { setLoggedIn(false); setLoading(false); return; }
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No se pudieron cargar los pedidos.");
      setOrders(data.orders || []);
      setLoggedIn(true);
    } catch (error) {
      setNotice(error.message);
      setLoginError(error.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadOrders(); }, [loadOrders]);
  useEffect(() => {
    if (!loggedIn) return undefined;
    const interval = window.setInterval(loadOrders, 15000);
    return () => window.clearInterval(interval);
  }, [loggedIn, loadOrders]);

  async function login(event) {
    event.preventDefault();
    setLoginError("");
    const response = await fetch("/api/auth/login", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password })
    });
    const data = await response.json();
    if (!response.ok) { setLoginError(data.error || "No se pudo iniciar sesión."); return; }
    setPassword("");
    await loadOrders();
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setLoggedIn(false);
    setOrders([]);
  }

  const filteredOrders = useMemo(() => {
    const q = search.trim().toLowerCase();
    return orders.filter((order) => {
      if (filterType !== "all" && order.order_type !== filterType) return false;
      if (filterStatus !== "all" && order.status !== filterStatus) return false;
      if (q && ![String(order.order_number), order.customer_name, order.customer_phone || "", order.delivery_address || "", order.table_number || ""].join(" ").toLowerCase().includes(q)) return false;
      return true;
    });
  }, [orders, filterType, filterStatus, search]);

  const totals = useMemo(() => ({
    total: orders.length,
    revenue: orders.filter((o) => o.status !== "cancelled").reduce((sum, o) => sum + Number(o.total || 0), 0),
    pending: orders.filter((o) => ["new", "accepted", "preparing", "on_the_way"].includes(o.status)).length,
    completed: orders.filter((o) => o.status === "completed").length,
    cancelled: orders.filter((o) => o.status === "cancelled").length
  }), [orders]);

  async function updateStatus(order, newStatus) {
    if (updating) return;
    let waWindow = null;
    const notifyCustomer = order.order_type === "delivery" && order.customer_phone && STATUS_MESSAGE[newStatus];
    if (notifyCustomer) waWindow = window.open("about:blank", "_blank");
    setUpdating(order.order_number);
    setNotice("");
    setNoticeLink("");
    try {
      const response = await fetch(`/api/orders/${order.order_number}/status`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: newStatus })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No se pudo actualizar el pedido.");
      setOrders((current) => current.map((item) => String(item.order_number) === String(order.order_number) ? data.order : item));
      if (notifyCustomer) {
        const number = phoneForWhatsApp(order.customer_phone);
        const text = STATUS_MESSAGE[newStatus].replace("#{number}", `#${order.order_number}`);
        const url = `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
        if (waWindow && !waWindow.closed) waWindow.location.href = url;
        else {
          setNotice("El estado se actualizó. El navegador bloqueó la ventana emergente; abre WhatsApp con el enlace de abajo y pulsa Enviar.");
          setNoticeLink(url);
        }
      }
    } catch (error) {
      if (waWindow && !waWindow.closed) waWindow.close();
      setNotice(error.message);
    } finally {
      setUpdating(null);
    }
  }

  function exportCSV() {
    const headers = ["Pedido", "Cliente", "Tipo", "Estado", "Total", "Pago", "Fecha"];
    const rows = filteredOrders.map((o) => [o.order_number, o.customer_name, TYPE_LABEL[o.order_type], STATUS[o.status]?.label || o.status, o.total, o.payment_method, new Date(o.created_at).toLocaleString("es-MX")]);
    const csv = [headers, ...rows].map((row) => row.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "pedidos-neruda.csv"; a.click(); URL.revokeObjectURL(url);
  }

  function actionsFor(order) {
    const busy = String(updating) === String(order.order_number);
    if (order.status === "completed" || order.status === "cancelled") return <span className="finished-note">Sin acciones pendientes</span>;
    if (order.order_type === "dine_in") {
      return <div className="action-stack">
        {order.status === "new" && <button disabled={busy} onClick={() => updateStatus(order, "accepted")}>Tomar pedido</button>}
        {order.status !== "completed" && <button className="btn-muted" disabled={busy} onClick={() => updateStatus(order, "completed")}>Marcar entregado</button>}
      </div>;
    }
    return <div className="action-stack">
      {order.status === "new" && <button disabled={busy} onClick={() => updateStatus(order, "accepted")}>Pedido tomado · avisar</button>}
      {order.status === "accepted" && <button disabled={busy} onClick={() => updateStatus(order, "preparing")}>En preparación · avisar</button>}
      {order.status === "preparing" && <button disabled={busy} onClick={() => updateStatus(order, "on_the_way")}>Va en camino · avisar</button>}
      {order.status === "on_the_way" && <button disabled={busy} onClick={() => updateStatus(order, "completed")}>Marcar entregado</button>}
      <button className="btn-danger" disabled={busy} onClick={() => updateStatus(order, "cancelled")}>Cancelar</button>
    </div>;
  }

  if (!loggedIn) {
    return <main className="login-screen">
      <form className="login-card" onSubmit={login}>
        <div className="login-logo">VP</div>
        <p className="eyebrow">VERMIPLATO · CAFÉ NERUDA</p>
        <h1>Panel de pedidos</h1>
        <p className="muted">Inicia sesión para consultar y administrar los pedidos del restaurante.</p>
        <label htmlFor="admin-password">Contraseña de administrador</label>
        <input id="admin-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Escribe tu contraseña" required />
        {loginError && <p className="error-text">{loginError}</p>}
        <button className="primary-button" type="submit">Entrar al panel</button>
        <p className="tiny-note">La contraseña se configura en las variables de entorno de Vercel.</p>
      </form>
    </main>;
  }

  return <div className="admin-shell">
    <aside className="sidebar">
      <div className="side-brand"><span className="brand-icon">☕</span><b>Café Neruda</b></div>
      <nav>
        <a href="#resumen">▦ <span>Dashboard</span></a>
        <a className="active" href="#pedidos">☷ <span>Pedidos</span></a>
        <a href="#domicilio" onClick={() => setFilterType("delivery")}>⌂ <span>A domicilio</span></a>
        <a href="#restaurante" onClick={() => setFilterType("dine_in")}>▤ <span>Restaurante</span></a>
      </nav>
      <div className="side-bottom"><span>VERMIPLATO</span><button onClick={logout}>↪ Cerrar sesión</button></div>
    </aside>

    <main className="admin-main">
      <header className="topbar"><div className="mobile-brand">☕ Café Neruda</div><div className="topbar-right"><span className="live-dot"></span> Panel de administración <button onClick={loadOrders} title="Actualizar pedidos">↻</button></div></header>
      <div className="page-content">
        <div className="breadcrumb">Dashboard <span>/</span> <b>Administración de pedidos</b></div>
        <div className="page-heading"><div><h1>Todos los pedidos</h1><p>Consulta, filtra y administra los pedidos de Café Neruda.</p></div><div className="heading-actions"><button className="outline-button" onClick={exportCSV}>⇩ Exportar</button><button className="gold-button" onClick={loadOrders}>↻ Actualizar</button></div></div>

        {notice && <div className="notice">{notice} {noticeLink && <a href={noticeLink} target="_blank" rel="noreferrer">Abrir WhatsApp</a>}</div>}

        <section className="stats-grid" id="resumen">
          <Stat label="Pedidos recibidos" value={totals.total} detail="Todos los pedidos" icon="▤" tone="sand" />
          <Stat label="Ventas registradas" value={money(totals.revenue)} detail="Excluye pedidos cancelados" icon="$" tone="mint" />
          <Stat label="Activos" value={totals.pending} detail="Requieren seguimiento" icon="◷" tone="yellow" />
          <Stat label="Entregados" value={totals.completed} detail="Pedidos completados" icon="✓" tone="mint" />
          <Stat label="Cancelados" value={totals.cancelled} detail="Pedidos cancelados" icon="×" tone="rose" />
        </section>

        <section className="orders-panel" id="pedidos">
          <div className="toolbar">
            <input className="search-box" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="⌕  Buscar por pedido, cliente o teléfono..." />
            <select value={filterType} onChange={(e) => setFilterType(e.target.value)}><option value="all">Todos los tipos</option><option value="delivery">A domicilio</option><option value="dine_in">Restaurante</option></select>
            <button className="outline-button" onClick={() => { setFilterStatus("all"); setFilterType("all"); setSearch(""); }}>Limpiar filtros</button>
          </div>
          <div className="filter-tabs">
            {[["all","Todos"],["new","Nuevos"],["accepted","Tomados"],["preparing","En preparación"],["on_the_way","En camino"],["completed","Entregados"],["cancelled","Cancelados"]].map(([value,label]) => <button key={value} className={filterStatus === value ? "selected" : ""} onClick={() => setFilterStatus(value)}>{label}<span>{value === "all" ? orders.length : orders.filter((o) => o.status === value).length}</span></button>)}
          </div>
          <div className="table-head"><h2>Pedidos recientes</h2><span>{filteredOrders.length} resultado(s)</span></div>
          {loading ? <div className="empty-state">Cargando pedidos…</div> : filteredOrders.length === 0 ? <div className="empty-state">Todavía no hay pedidos que coincidan con estos filtros.</div> : <div className="table-wrap">
            <table>
              <thead><tr><th>PEDIDO</th><th>CLIENTE</th><th>TIPO</th><th>ESTADO</th><th>IMPORTE</th><th>PAGO</th><th>FECHA</th><th>ACCIONES</th></tr></thead>
              <tbody>{filteredOrders.map((order) => <tr key={order.order_number} className={order.status === "new" ? "row-new" : order.status === "completed" ? "row-completed" : ""}>
                <td><b>#{String(order.order_number).padStart(4, "0")}</b><small>{Array.isArray(order.items) ? order.items.reduce((sum, item) => sum + Number(item.quantity || 0), 0) : 0} artículo(s)</small></td>
                <td><b>{order.customer_name}</b><small>{order.order_type === "delivery" ? (order.customer_phone || "Sin teléfono") : `Mesa ${order.table_number || "—"}`}</small></td>
                <td><span className={`type-pill ${order.order_type}`}>{order.order_type === "delivery" ? "🛵 Domicilio" : "🍽 Restaurante"}</span></td>
                <td><span className={`status-pill ${STATUS[order.status]?.color || "gray"}`}>{STATUS[order.status]?.label || order.status}</span></td>
                <td className="amount-cell">{money(order.total)}</td>
                <td><span className="payment-pill">{order.payment_method}</span></td>
                <td><b>{new Date(order.created_at).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}</b><small>{new Date(order.created_at).toLocaleDateString("es-MX", { day: "2-digit", month: "short" })}</small></td>
                <td><details className="order-details"><summary>Ver pedido</summary><div className="details-pop"><b>Productos</b>{(order.items || []).map((item, index) => <p key={index}>{item.quantity} × {item.name} — {money(item.lineTotal)}</p>)}{order.order_type === "delivery" ? <><b>Dirección</b><p>{order.delivery_address || "—"}</p><p>{order.delivery_references || "Sin referencias"}</p>{order.location_url && <a href={order.location_url} target="_blank" rel="noreferrer">Ver ubicación</a>}</> : <p>Mesa: {order.table_number || "—"}</p>}<p>Notas: {order.notes || "Ninguna"}</p><p>Teléfono: {order.customer_phone || "—"}</p></div></details>{actionsFor(order)}</td>
              </tr>)}</tbody>
            </table>
          </div>}
        </section>
        <p className="footer-note">VermiPlato · Los pedidos nuevos aparecen en verde. Los pedidos entregados aparecen en gris. El panel se actualiza automáticamente cada 15 segundos.</p>
      </div>
    </main>
  </div>;
}

function Stat({ label, value, detail, icon, tone }) {
  return <div className="stat-card"><div><span className="stat-label">{label}</span><strong>{value}</strong><small>{detail}</small></div><span className={`stat-icon ${tone}`}>{icon}</span></div>;
}

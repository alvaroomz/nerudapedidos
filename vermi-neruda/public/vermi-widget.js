/* VermiPlato order widget - embed into the existing Café Neruda menu.
   Product buttons must include data-vp-order and data-vp-code. */
(() => {
  if (window.__VERMIPLATO_WIDGET_LOADED__) return;
  window.__VERMIPLATO_WIDGET_LOADED__ = true;

  const script = document.currentScript;
  const API_BASE = (script?.dataset.apiBase || new URL(script.src).origin).replace(/\/$/, "");
  const RESTAURANT = script?.dataset.restaurant || "cafe-neruda";
  const state = { cart: [], view: "cart", messages: [], questionIndex: 0, answers: {}, orderType: null, config: null, busy: false };
  const money = (value) => new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(Number(value || 0));
  const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));

  const style = document.createElement("style");
  style.textContent = `
    #vp-fab{position:fixed;z-index:99990;top:16px;left:16px;border:0;border-radius:999px;padding:12px 17px;background:#70452f;color:#fff;font:700 14px Arial,sans-serif;box-shadow:0 5px 22px #0002;cursor:pointer}
    #vp-fab:hover{background:#51301f} #vp-fab .vp-count{display:inline-grid;place-items:center;min-width:21px;height:21px;margin-left:6px;border-radius:50%;background:#fff;color:#70452f;font-size:11px}
    #vp-panel{position:fixed;z-index:99999;top:69px;left:16px;width:min(390px,calc(100vw - 32px));height:min(650px,calc(100vh - 88px));display:none;flex-direction:column;background:#fff;border:1px solid #e8ddd4;border-radius:18px;box-shadow:0 16px 48px #0003;overflow:hidden;font-family:Arial,sans-serif;color:#29231f}
    #vp-panel.vp-open{display:flex} .vp-head{display:flex;align-items:center;justify-content:space-between;padding:14px 16px;background:#70452f;color:#fff}
    .vp-head strong{font-size:15px}.vp-head small{display:block;margin-top:3px;font-size:11px;opacity:.82}.vp-close{border:0;background:transparent;color:#fff;font-size:25px;cursor:pointer}
    .vp-content{flex:1;overflow:auto;padding:14px;background:#fbf7f1}.vp-footer{padding:11px;background:#fff;border-top:1px solid #eee4dd}
    .vp-title{margin:0 0 10px;font-size:16px}.vp-muted{font-size:12px;color:#746b64;line-height:1.45}
    .vp-cart-row{display:grid;grid-template-columns:1fr auto;gap:8px;padding:11px;margin-bottom:8px;background:#fff;border:1px solid #eadfd6;border-radius:12px}
    .vp-cart-name{font-size:13px;font-weight:700}.vp-cart-price{margin-top:4px;font-size:12px;color:#766d66}.vp-qty{display:flex;align-items:center;gap:7px}.vp-qty button,.vp-remove{width:27px;height:27px;border:1px solid #d8c9bd;border-radius:50%;background:#fff;color:#553522;cursor:pointer}.vp-remove{border-radius:7px;color:#a33434}
    .vp-total{display:flex;justify-content:space-between;margin:14px 2px;font-weight:700}.vp-btn{width:100%;padding:12px 13px;border:0;border-radius:10px;background:#70452f;color:#fff;font-size:13px;font-weight:700;cursor:pointer}.vp-btn:disabled{opacity:.5;cursor:not-allowed}.vp-btn-secondary{margin-top:8px;background:#fff;color:#70452f;border:1px solid #cdb9aa}
    .vp-choice{display:inline-flex;align-items:center;margin:4px 5px 4px 0;padding:9px 12px;border:1px solid #cdb9aa;border-radius:18px;background:#fff;color:#593a28;font-size:12px;cursor:pointer}
    .vp-bubble{max-width:92%;width:fit-content;margin:0 0 9px;padding:10px 12px;border-radius:12px;background:#fff;border:1px solid #eadfd6;font-size:13px;line-height:1.45;white-space:pre-wrap;overflow-wrap:anywhere}
    .vp-bubble.user{margin-left:auto;background:#e6f3e9;border-color:#d4e9d9}.vp-form-label{display:block;margin:7px 0 5px;font-size:12px;font-weight:700}.vp-input{width:100%;padding:11px;border:1px solid #ded2c9;border-radius:9px;background:#fff;font:13px Arial,sans-serif;outline:none}.vp-input:focus{border-color:#936c50}.vp-input-area{display:grid;gap:7px}.vp-small{margin:8px 1px 0;color:#766d66;font-size:10px;line-height:1.4}.vp-error{margin:7px 0;color:#b42318;font-size:12px}.vp-empty{padding:25px 12px;text-align:center;color:#756b63;font-size:13px;line-height:1.5}
    .vp-product-added{outline:2px solid #6b9e78!important}
    @media(max-width:480px){#vp-fab{top:11px;left:11px}#vp-panel{top:62px;left:11px;width:calc(100vw - 22px);height:calc(100vh - 76px)}}
  `;
  document.head.appendChild(style);

  const fab = document.createElement("button");
  fab.id = "vp-fab";
  fab.type = "button";
  fab.innerHTML = `🛍️ Pedidos <span class="vp-count">0</span>`;
  const panel = document.createElement("section");
  panel.id = "vp-panel";
  panel.innerHTML = `
    <header class="vp-head"><div><strong id="vp-restaurant-title">Pedidos a domicilio</strong><small>Asistente de pedidos VermiPlato</small></div><button class="vp-close" type="button" aria-label="Cerrar">×</button></header>
    <div class="vp-content" id="vp-content"></div><footer class="vp-footer" id="vp-footer"></footer>`;
  document.body.append(fab, panel);
  const content = panel.querySelector("#vp-content");
  const footer = panel.querySelector("#vp-footer");
  const countEl = fab.querySelector(".vp-count");

  function cartCount() { return state.cart.reduce((sum, item) => sum + item.quantity, 0); }
  function cartTotal() { return state.cart.reduce((sum, item) => sum + item.quantity * item.price, 0); }
  function updateFab() { countEl.textContent = String(cartCount()); }
  function openPanel() { panel.classList.add("vp-open"); render(); }
  function closePanel() { panel.classList.remove("vp-open"); }
  function addProduct(code, name, price) {
    if (!code) return;
    const existing = state.cart.find((item) => item.code === code);
    if (existing) existing.quantity += 1;
    else state.cart.push({ code, name: name || code, price: Number(price || 0), quantity: 1 });
    updateFab();
    const oldView = state.view;
    if (oldView === "cart") renderCart();
    const toast = document.createElement("div");
    toast.textContent = `${name || "Producto"} agregado al pedido`;
    toast.style.cssText = "position:fixed;z-index:100000;top:70px;left:16px;max-width:calc(100vw - 32px);padding:10px 13px;border-radius:10px;background:#243c2d;color:white;font:12px Arial;box-shadow:0 5px 18px #0003";
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 1600);
  }

  function renderCart() {
    state.view = "cart";
    content.innerHTML = `<h3 class="vp-title">Tu pedido</h3>`;
    if (!state.cart.length) {
      content.innerHTML += `<div class="vp-empty">Todavía no agregas platillos.<br>Regresa al menú y presiona <b>Ordenar</b> debajo del precio de cada producto.</div>`;
      footer.innerHTML = `<button class="vp-btn vp-btn-secondary" type="button" data-vp-close>Seguir mirando platillos</button>`;
      return;
    }
    state.cart.forEach((item, index) => {
      const row = document.createElement("div");
      row.className = "vp-cart-row";
      row.innerHTML = `<div><div class="vp-cart-name">${escapeHtml(item.name)}</div><div class="vp-cart-price">${money(item.price)} c/u · ${money(item.price * item.quantity)}</div></div>
        <div style="display:flex;align-items:center;gap:5px"><div class="vp-qty"><button type="button" data-vp-minus="${index}" aria-label="Restar">−</button><b>${item.quantity}</b><button type="button" data-vp-plus="${index}" aria-label="Sumar">+</button></div><button class="vp-remove" type="button" data-vp-remove="${index}" aria-label="Eliminar">×</button></div>`;
      content.appendChild(row);
    });
    const total = document.createElement("div");
    total.className = "vp-total";
    total.innerHTML = `<span>Subtotal estimado</span><span>${money(cartTotal())}</span>`;
    content.appendChild(total);
    const note = document.createElement("p");
    note.className = "vp-muted";
    note.textContent = "El costo de envío, si aplica, será confirmado por el restaurante.";
    content.appendChild(note);
    footer.innerHTML = `<button class="vp-btn" type="button" data-vp-checkout>Ordenar</button><button class="vp-btn vp-btn-secondary" type="button" data-vp-close>Seguir mirando platillos</button>`;
  }

  function pushMessage(text, who = "bot") { state.messages.push({ text, who }); }
  function renderMessages() {
    state.view = "chat";
    content.innerHTML = "";
    state.messages.forEach((message) => {
      const bubble = document.createElement("div");
      bubble.className = `vp-bubble ${message.who === "user" ? "user" : ""}`;
      bubble.textContent = message.text;
      content.appendChild(bubble);
    });
    content.scrollTop = content.scrollHeight;
  }

  const deliveryQuestions = [
    { key: "name", prompt: "¿A nombre de quién registramos el pedido?", required: true, placeholder: "Nombre completo" },
    { key: "phone", prompt: "¿Cuál es tu número de contacto?", required: true, placeholder: "Teléfono de 10 dígitos", type: "tel" },
    { key: "address", prompt: "Escribe tu dirección completa: calle, número y colonia.", required: true, placeholder: "Dirección de entrega" },
    { key: "locationUrl", prompt: "¿Deseas compartir tu ubicación actual? Es opcional; también puedes continuar sin compartirla.", required: false, placeholder: "Enlace de ubicación o dejar vacío", location: true },
    { key: "references", prompt: "¿Alguna referencia para encontrar tu domicilio?", required: false, placeholder: "Ej. Casa azul, frente al parque" },
    { key: "paymentMethod", prompt: "¿Cómo deseas pagar?", required: true, choices: ["Efectivo", "Transferencia", "Tarjeta al recibir"] },
    { key: "cashChangeFor", prompt: "¿Con cuánto pagarás para preparar el cambio? Escribe “No necesito cambio” si tienes el importe exacto.", required: false, placeholder: "Ej. Pago con $500 / No necesito cambio", onlyCash: true },
    { key: "notes", prompt: "¿Tienes alguna indicación adicional? (opcional)", required: false, placeholder: "Ej. Sin cebolla / Ninguna" }
  ];
  const dineInQuestions = [
    { key: "tableNumber", prompt: "¿En qué mesa te encuentras?", required: true, placeholder: "Número o nombre de mesa" },
    { key: "name", prompt: "¿A nombre de quién registramos el pedido?", required: true, placeholder: "Tu nombre" },
    { key: "phone", prompt: "¿Cuál es tu teléfono de contacto? (opcional)", required: false, placeholder: "Teléfono" , type: "tel"},
    { key: "paymentMethod", prompt: "¿Cómo prefieres pagar?", required: true, choices: ["Pagar en caja", "Efectivo", "Tarjeta", "Transferencia"] },
    { key: "notes", prompt: "¿Alguna indicación para cocina? (opcional)", required: false, placeholder: "Ej. Sin azúcar / Ninguna" }
  ];
  let currentQuestions = [];

  function beginCheckout() {
    if (!state.cart.length) return;
    state.messages = [];
    state.answers = {};
    state.questionIndex = -1;
    pushMessage("¡Perfecto! Antes de enviar tu pedido, necesito algunos datos.");
    pushMessage("¿Tu pedido es a domicilio o para consumir en el restaurante?");
    state.view = "type";
    renderMessages();
    footer.innerHTML = `<button class="vp-choice" type="button" data-vp-type="delivery">🛵 A domicilio</button><button class="vp-choice" type="button" data-vp-type="dine_in">🍽️ Comer aquí</button><button class="vp-btn vp-btn-secondary" type="button" data-vp-back-cart>Volver al pedido</button>`;
  }

  function beginQuestions(type) {
    state.orderType = type;
    currentQuestions = type === "delivery" ? deliveryQuestions : dineInQuestions;
    state.questionIndex = 0;
    pushMessage(type === "delivery" ? "Elegiste entrega a domicilio." : "Elegiste consumir en el restaurante.");
    askQuestion();
  }

  function activeQuestion() {
    while (state.questionIndex < currentQuestions.length) {
      const q = currentQuestions[state.questionIndex];
      if (q.onlyCash && state.answers.paymentMethod !== "Efectivo") {
        state.questionIndex += 1;
        continue;
      }
      return q;
    }
    return null;
  }

  function askQuestion() {
    const q = activeQuestion();
    if (!q) { showReview(); return; }
    pushMessage(q.prompt);
    renderMessages();
    footer.innerHTML = `<div class="vp-input-area" id="vp-input-area"></div>`;
    const area = footer.querySelector("#vp-input-area");
    if (q.choices) {
      q.choices.forEach((choice) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "vp-choice";
        button.textContent = choice;
        button.addEventListener("click", () => answerQuestion(choice));
        area.appendChild(button);
      });
    } else {
      const input = document.createElement("input");
      input.className = "vp-input";
      input.id = "vp-answer";
      input.placeholder = q.placeholder || "Escribe tu respuesta";
      input.type = q.type || "text";
      area.appendChild(input);
      if (q.location) {
        const locationButton = document.createElement("button");
        locationButton.type = "button";
        locationButton.className = "vp-choice";
        locationButton.textContent = "📍 Compartir ubicación actual";
        locationButton.addEventListener("click", () => {
          if (!navigator.geolocation) { showError("Este navegador no permite obtener la ubicación."); return; }
          locationButton.disabled = true;
          locationButton.textContent = "Obteniendo ubicación…";
          navigator.geolocation.getCurrentPosition((position) => {
            input.value = `https://www.google.com/maps?q=${position.coords.latitude},${position.coords.longitude}`;
            locationButton.textContent = "Ubicación agregada";
          }, () => {
            locationButton.disabled = false;
            locationButton.textContent = "📍 Compartir ubicación actual";
            showError("No se pudo obtener la ubicación. Revisa el permiso del navegador o continúa sin compartirla.");
          }, { enableHighAccuracy: true, timeout: 10000 });
        });
        area.appendChild(locationButton);
      }
      const actions = document.createElement("div");
      actions.style.display = "flex";
      actions.style.gap = "7px";
      const send = document.createElement("button");
      send.type = "button";
      send.className = "vp-btn";
      send.textContent = q.required ? "Continuar" : "Guardar respuesta";
      send.addEventListener("click", () => answerQuestion(input.value));
      actions.appendChild(send);
      if (!q.required) {
        const skip = document.createElement("button");
        skip.type = "button";
        skip.className = "vp-btn vp-btn-secondary";
        skip.textContent = "Omitir";
        skip.addEventListener("click", () => answerQuestion(""));
        actions.appendChild(skip);
      }
      area.appendChild(actions);
      input.addEventListener("keydown", (event) => { if (event.key === "Enter") answerQuestion(input.value); });
      input.focus();
    }
    const note = document.createElement("p");
    note.className = "vp-small";
    note.textContent = `Pregunta ${state.questionIndex + 1} de ${currentQuestions.filter((item) => !item.onlyCash || state.answers.paymentMethod === "Efectivo").length}.`;
    area.appendChild(note);
  }

  function showError(message) {
    const old = footer.querySelector(".vp-error");
    if (old) old.remove();
    const error = document.createElement("div");
    error.className = "vp-error";
    error.textContent = message;
    footer.prepend(error);
  }

  function answerQuestion(value) {
    const q = activeQuestion();
    if (!q) return;
    const clean = String(value ?? "").trim();
    if (q.required && !clean) { showError("Este dato es necesario para continuar."); return; }
    if (q.key === "phone" && clean && !/^\+?[\d\s()-]{10,18}$/.test(clean)) { showError("Escribe un número de teléfono válido."); return; }
    state.answers[q.key] = clean;
    pushMessage(clean || "(Omitido)", "user");
    state.questionIndex += 1;
    askQuestion();
  }

  function showReview() {
    state.view = "review";
    pushMessage("¡Gracias! Revisa tu pedido antes de confirmarlo.");
    renderMessages();
    const lines = state.cart.map((item) => `${item.quantity} × ${item.name} — ${money(item.quantity * item.price)}`).join("\n");
    const details = state.orderType === "delivery"
      ? `Entrega a domicilio\nNombre: ${state.answers.name}\nTeléfono: ${state.answers.phone}\nDirección: ${state.answers.address}\nReferencias: ${state.answers.references || "Sin referencias"}\nPago: ${state.answers.paymentMethod}\nCambio: ${state.answers.cashChangeFor || "No aplica"}\nIndicaciones: ${state.answers.notes || "Ninguna"}`
      : `Consumo en restaurante\nMesa: ${state.answers.tableNumber}\nNombre: ${state.answers.name}\nPago: ${state.answers.paymentMethod}\nIndicaciones: ${state.answers.notes || "Ninguna"}`;
    const summary = document.createElement("div");
    summary.className = "vp-bubble";
    summary.textContent = `PRODUCTOS\n${lines}\n\nSubtotal estimado: ${money(cartTotal())}\n\n${details}`;
    content.appendChild(summary);
    content.scrollTop = content.scrollHeight;
    footer.innerHTML = `<button class="vp-btn" type="button" data-vp-confirm>Confirmar pedido</button><button class="vp-btn vp-btn-secondary" type="button" data-vp-edit>Volver a editar</button><p class="vp-small">El costo de envío, cuando aplique, lo confirmará el restaurante. Para pedidos a domicilio, WhatsApp abrirá el mensaje preparado y tendrás que pulsar Enviar.</p>`;
  }

  async function confirmOrder(button) {
    if (state.busy) return;
    state.busy = true;
    button.disabled = true;
    button.textContent = "Registrando pedido…";
    let whatsappWindow = null;
    if (state.orderType === "delivery") whatsappWindow = window.open("about:blank", "_blank");
    try {
      const response = await fetch(`${API_BASE}/api/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurantSlug: RESTAURANT,
          type: state.orderType,
          customerName: state.answers.name,
          phone: state.answers.phone || "",
          address: state.answers.address || "",
          locationUrl: state.answers.locationUrl || "",
          references: state.answers.references || "",
          paymentMethod: state.answers.paymentMethod || "Pago en restaurante",
          cashChangeFor: state.answers.cashChangeFor || "",
          notes: state.answers.notes || "",
          tableNumber: state.answers.tableNumber || "",
          items: state.cart.map((item) => ({ code: item.code, quantity: item.quantity }))
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No se pudo registrar el pedido.");
      state.view = "done";
      content.innerHTML = "";
      const done = document.createElement("div");
      done.className = "vp-empty";
      done.innerHTML = `<div style="font-size:34px;margin-bottom:9px">✅</div><b>Pedido #${escapeHtml(data.order.order_number)} registrado</b><br><br>${state.orderType === "delivery" ? "Tu pedido quedó registrado. Abre WhatsApp para compartir los detalles con Café Neruda." : "Tu pedido quedó registrado para el restaurante. El personal podrá verlo en el panel de pedidos."}`;
      content.appendChild(done);
      footer.innerHTML = "";
      if (state.orderType === "delivery") {
        const waUrl = `https://wa.me/${data.whatsappNumber}?text=${encodeURIComponent(data.whatsappText)}`;
        const waButton = document.createElement("a");
        waButton.className = "vp-btn";
        waButton.href = waUrl;
        waButton.target = "_blank";
        waButton.rel = "noopener noreferrer";
        waButton.style.display = "block";
        waButton.style.textAlign = "center";
        waButton.style.textDecoration = "none";
        waButton.textContent = "Abrir WhatsApp con mi pedido";
        footer.appendChild(waButton);
        if (whatsappWindow && !whatsappWindow.closed) whatsappWindow.location.href = waUrl;
      } else if (whatsappWindow && !whatsappWindow.closed) {
        whatsappWindow.close();
      }
      const newOrder = document.createElement("button");
      newOrder.type = "button";
      newOrder.className = "vp-btn vp-btn-secondary";
      newOrder.style.marginTop = "8px";
      newOrder.textContent = "Volver al menú";
      newOrder.addEventListener("click", () => { state.cart = []; updateFab(); closePanel(); renderCart(); });
      footer.appendChild(newOrder);
      state.cart = [];
      updateFab();
    } catch (error) {
      if (whatsappWindow && !whatsappWindow.closed) whatsappWindow.close();
      showError(error.message || "Ocurrió un error.");
      button.disabled = false;
      button.textContent = "Reintentar";
    } finally {
      state.busy = false;
    }
  }

  fab.addEventListener("click", () => panel.classList.contains("vp-open") ? closePanel() : openPanel());
  panel.querySelector(".vp-close").addEventListener("click", closePanel);
  panel.addEventListener("click", (event) => {
    const target = event.target;
    if (target.closest("[data-vp-close]")) { closePanel(); return; }
    if (target.closest("[data-vp-checkout]")) { beginCheckout(); return; }
    if (target.closest("[data-vp-back-cart]")) { renderCart(); return; }
    if (target.closest("[data-vp-edit]")) { beginCheckout(); return; }
    const typeButton = target.closest("[data-vp-type]");
    if (typeButton) { beginQuestions(typeButton.dataset.vpType); return; }
    const minus = target.closest("[data-vp-minus]");
    const plus = target.closest("[data-vp-plus]");
    const remove = target.closest("[data-vp-remove]");
    if (minus || plus || remove) {
      const index = Number((minus || plus || remove).dataset.vpMinus ?? (minus || plus || remove).dataset.vpPlus ?? (minus || plus || remove).dataset.vpRemove);
      if (remove) state.cart.splice(index, 1);
      else if (minus) state.cart[index].quantity = Math.max(1, state.cart[index].quantity - 1);
      else state.cart[index].quantity += 1;
      updateFab(); renderCart(); return;
    }
    const confirm = target.closest("[data-vp-confirm]");
    if (confirm) confirmOrder(confirm);
  });

  document.addEventListener("click", (event) => {
    const button = event.target.closest("[data-vp-order]");
    if (!button) return;
    event.preventDefault();
    addProduct(button.dataset.vpCode, button.dataset.vpName || button.dataset.vpCode, button.dataset.vpPrice || "0");
  });

  fetch(`${API_BASE}/api/public/config?restaurant=${encodeURIComponent(RESTAURANT)}`)
    .then((response) => response.ok ? response.json() : Promise.reject(new Error("No se pudo cargar la configuración del restaurante.")))
    .then((data) => {
      state.config = data.restaurant;
      panel.querySelector("#vp-restaurant-title").textContent = data.restaurant.name;
    })
    .catch((error) => console.warn("VermiPlato:", error.message));

  renderCart();
})();

# VermiPlato · Pedidos de Café Neruda

Este proyecto agrega tres piezas a tu menú actual:

1. **Widget del menú** (`public/vermi-widget.js`): botón flotante “Pedidos”, carrito, cantidades, eliminación de productos y conversación guiada.
2. **API + base de datos**: registra pedidos a domicilio y pedidos para consumir en el restaurante. Valida cada producto y su precio contra PostgreSQL.
3. **Panel administrativo** (`/pedidos`): muestra los pedidos, filtros, totales, estados y avisos preparados para WhatsApp.

La pantalla administrativa está basada en la imagen de referencia: menú lateral, tarjetas superiores, filtros y tabla de pedidos.

## Cómo funciona el flujo

### Desde el menú digital

- Cada platillo lleva un botón **Ordenar** debajo del precio.
- Al pulsarlo, ese artículo se agrega al carrito y aumenta el contador del botón flotante de VermiPlato.
- En el carrito se puede aumentar o disminuir la cantidad, o eliminar un producto.
- Al pulsar **Continuar para ordenar**, el cliente elige entre **A domicilio** y **Comer aquí**.
- Para domicilio, el bot solicita nombre, teléfono, dirección, ubicación actual opcional, referencias, método de pago, cambio para efectivo e indicaciones.
- Para comer aquí, solicita mesa, nombre, teléfono opcional y forma de pago.
- Antes de registrar, muestra un resumen.
- Al confirmar, ambos tipos se guardan en la base de datos.
- Si es a domicilio, abre WhatsApp con el resumen preparado para enviarlo al restaurante. El cliente todavía debe pulsar **Enviar** en WhatsApp.
- Si es para comer en el restaurante, solamente se guarda en la base y aparece en el panel.

### Desde el panel administrativo

- Los pedidos nuevos aparecen con fondo verde claro.
- Los entregados aparecen en gris.
- En los pedidos a domicilio, las acciones avanzan por: **Pedido tomado → En preparación → En camino → Entregado**.
- Al avanzar los primeros estados, se abre WhatsApp con un mensaje preparado para el cliente. El administrador debe pulsar **Enviar**.
- Los pedidos para comer en el restaurante se pueden tomar y marcar como entregados desde el panel.
- La lista se actualiza cada 15 segundos y permite exportar CSV.

---

# Instalación y puesta en marcha

## 1. Crear el proyecto de base de datos desde Vercel

Para proyectos nuevos, Vercel ya no ofrece el producto antiguo “Vercel Postgres”. La ruta actual es instalar un proveedor PostgreSQL desde el Marketplace; este proyecto está preparado para **Neon**.

1. En Vercel, abre el proyecto nuevo que usarás para el panel de pedidos.
2. Entra a **Storage** o **Marketplace**.
3. Busca e instala **Neon Postgres**.
4. Crea una base de datos y conecta la integración al proyecto Vercel.
5. Comprueba que Vercel haya agregado la variable `DATABASE_URL` al entorno Production (y a Development si la usarás localmente).
6. Después de conectar la base, vuelve a desplegar el proyecto.

No crees un archivo SQL llamado `mi_base_de_datos` ni uses `USE ...`: Neon utiliza PostgreSQL, no MySQL. La base se crea desde la integración de Neon y las tablas se crean ejecutando el siguiente archivo.

## 2. Crear las tablas

1. Abre el proyecto de Neon desde Vercel.
2. Entra al **SQL Editor** de Neon.
3. Abre `sql/schema.sql` de este proyecto.
4. Copia todo su contenido y ejecútalo en el SQL Editor.
5. Se crearán `restaurants`, `menu_items` y `orders`, además de índices y registros de ejemplo.

### 2.1 Configura el WhatsApp real del restaurante

En el SQL Editor ejecuta esta consulta sustituyendo el número por el número ACTUAL de Café Neruda en formato internacional, sin espacios ni signos. Ejemplo de formato mexicano: `52` + lada + número de 10 dígitos.

```sql
UPDATE restaurants
SET whatsapp_number = '52XXXXXXXXXX'
WHERE slug = 'cafe-neruda';
```

El SQL de ejemplo utiliza deliberadamente `REEMPLAZAR_NUMERO_WHATSAPP`; los pedidos a domicilio no se podrán confirmar hasta sustituirlo por el número correcto.

### 2.2 Sustituye los productos de ejemplo por los reales

El SQL crea tres productos de demostración: café americano, hamburguesa y papas. Debes reemplazarlos por los platillos reales que aparecen en el menú de Neruda.

Puedes actualizar un producto así:

```sql
UPDATE menu_items AS m
SET name = 'Nombre real del platillo', price = 89.00, active = TRUE
FROM restaurants AS r
WHERE m.restaurant_id = r.id
  AND r.slug = 'cafe-neruda'
  AND m.code = 'hamburguesa-clasica';
```

Para agregar otro producto:

```sql
INSERT INTO menu_items (restaurant_id, code, name, price)
SELECT id, 'nuevo-codigo', 'Nombre real del producto', 75.00
FROM restaurants
WHERE slug = 'cafe-neruda';
```

Usa códigos únicos, sin espacios ni acentos, por ejemplo `capuchino-mediano`. El código será el mismo que pondrás en el botón del menú.

Puedes consultar tus productos así:

```sql
SELECT m.code, m.name, m.price, m.active
FROM menu_items m
JOIN restaurants r ON r.id = m.restaurant_id
WHERE r.slug = 'cafe-neruda'
ORDER BY m.name;
```

## 3. Preparar las variables de entorno

En Vercel abre el proyecto del panel → **Settings → Environment Variables** y configura:

| Variable | Valor |
|---|---|
| `DATABASE_URL` | La crea Neon al conectar la integración. No la publiques. |
| `ADMIN_PASSWORD` | Una contraseña larga y privada para entrar al panel. |
| `SESSION_SECRET` | Una cadena aleatoria de al menos 32 caracteres. |
| `MENU_ORIGIN` | `https://neruda.vermiplato.com` (sin `/` al final). |
| `RESTAURANT_SLUG` | `cafe-neruda` (slug de este restaurante). |

Para generar un secreto aleatorio en una terminal con Node.js puedes ejecutar:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Copia el resultado en `SESSION_SECRET`. No subas `.env`, claves, contraseñas ni `DATABASE_URL` a GitHub.

Si también vas a probar desde otro dominio (por ejemplo un sitio temporal), agrégalo en `MENU_ORIGIN` separado por coma:

```text
https://neruda.vermiplato.com,https://TU-USUARIO.github.io
```

Guarda las variables y vuelve a desplegar en Vercel.

## 4. Subir este proyecto a GitHub y desplegarlo en Vercel

1. Descarga y descomprime el ZIP.
2. Crea un repositorio nuevo en GitHub y sube **el contenido** de la carpeta `vermi-neruda` (no la carpeta ZIP).
3. En Vercel elige **Add New → Project** y conecta ese repositorio.
4. Framework: Next.js (Vercel lo detecta automáticamente).
5. Despliega después de conectar Neon y configurar las variables de entorno.

La dirección temporal debe quedar similar a `https://NOMBRE-DEL-PROYECTO.vercel.app/pedidos`.

## 5. Conectar el subdominio pedido por ti

En el proyecto nuevo de Vercel entra a **Settings → Domains** y agrega:

```text
pedidosneruda.vermiplato.com
```

Vercel indicará el registro DNS exacto que debes configurar. En GoDaddy, entra a DNS y crea el registro que Vercel te muestre. No inventes el destino: copia exactamente el valor que te dé Vercel. Cuando el dominio esté activo, el panel estará en:

```text
https://pedidosneruda.vermiplato.com/pedidos
```

El widget se servirá desde:

```text
https://pedidosneruda.vermiplato.com/vermi-widget.js
```

## 6. Integrar el botón Ordenar en tu menú Neruda

### 6.1 Agrega el script una sola vez

En el `index.html` del menú actual de Neruda, justo antes de `</body>`, agrega:

```html
<script
  src="https://pedidosneruda.vermiplato.com/vermi-widget.js"
  data-api-base="https://pedidosneruda.vermiplato.com"
  data-restaurant="cafe-neruda"
  defer
></script>
```

Esto agrega el botón flotante de pedidos en la esquina superior izquierda y la ventana del carrito/chat.

### 6.2 Agrega el botón debajo del precio de CADA platillo

En el HTML de cada tarjeta de producto, debajo del precio, agrega un botón con el código registrado en `menu_items`.

Ejemplo para el producto de prueba `hamburguesa-clasica`:

```html
<div class="producto">
  <h3>Hamburguesa clásica</h3>
  <p>$90.00</p>
  <button
    type="button"
    data-vp-order
    data-vp-code="hamburguesa-clasica"
    data-vp-name="Hamburguesa clásica"
    data-vp-price="90.00"
  >
    Ordenar
  </button>
</div>
```

Repite el patrón en cada platillo. Los atributos importantes son:

- `data-vp-order`: indica que es un botón que agrega al carrito.
- `data-vp-code`: debe coincidir exactamente con `menu_items.code`.
- `data-vp-name`: nombre que se muestra en el carrito.
- `data-vp-price`: precio para mostrar en la vista del carrito. El backend vuelve a consultar y usa el precio de la base de datos al registrar el pedido.

**Importante:** los tres productos del SQL son ejemplos. Sustituye sus nombres, precios y códigos por los de tu menú real. Si un código del botón no existe o está inactivo en la base, el servidor rechazará ese pedido para evitar guardar productos/precios incorrectos.

## 7. Probar el sistema

1. Abre `https://neruda.vermiplato.com`.
2. Pulsa **Ordenar** en dos o más platillos.
3. Abre el botón flotante **Pedidos** y confirma que aparezcan.
4. Prueba los botones `+`, `−` y `×`.
5. Selecciona **A domicilio**, completa los datos y confirma.
6. Comprueba que se abrió WhatsApp con el mensaje preparado. En WhatsApp pulsa **Enviar** para que el restaurante reciba el mensaje.
7. Abre `https://pedidosneruda.vermiplato.com/pedidos`, inicia sesión y comprueba que el pedido esté en verde.
8. Avanza el estado y verifica que se abra WhatsApp con el aviso para el cliente.
9. Repite el flujo como **Comer aquí**. Este pedido debe aparecer en el panel sin abrir WhatsApp.
10. Marca un pedido como entregado y confirma que la fila cambie a gris.

---

# Importante sobre WhatsApp

La versión incluida utiliza enlaces `wa.me` con texto precargado. Esto **abre la conversación y deja el mensaje escrito**, pero el usuario (cliente o administrador) debe pulsar **Enviar** en WhatsApp. Un enlace no puede enviar el mensaje por sí solo.

Para que los avisos de estado se envíen automáticamente sin que el administrador abra WhatsApp, se debe integrar la **WhatsApp Business Platform / Cloud API**, registrar el número del negocio, configurar credenciales seguras y, cuando corresponda, usar plantillas de mensajes aprobadas. Esa integración no queda activada por este prototipo.

# Alcance y cosas que faltan antes de producción

- Este entregable es una primera versión funcional de un restaurante, con el slug `cafe-neruda`. La base ya separa datos por restaurante, pero antes de venderlo a varios negocios hay que añadir administración multi-restaurante y permisos para que cada propietario solo vea sus pedidos.
- La contraseña del panel es única y se configura con `ADMIN_PASSWORD`. Para varios empleados/restaurantes conviene crear usuarios, roles y recuperación segura de contraseña.
- Antes de recibir pedidos reales de forma abierta, agrega protección anti-spam/rate limiting, políticas de privacidad y una revisión de seguridad.
- La ubicación en tiempo real usa el permiso de geolocalización del navegador. Si el cliente no autoriza, puede continuar escribiendo su dirección; la ubicación no es obligatoria.
- No se calcula la tarifa de envío porque todavía no se proporcionaron zonas ni costos de reparto. El panel guarda subtotal y el restaurante confirma envío y total final.
- Los pedidos se refrescan en el panel cada 15 segundos; todavía no son actualizaciones instantáneas con WebSockets.
- No hay integración de inventario ni descuento automático de existencias.

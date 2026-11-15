-- VermiPlato / Café Neruda
-- Motor: PostgreSQL (Neon). Ejecuta este archivo completo en el SQL Editor de Neon.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS restaurants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug VARCHAR(80) NOT NULL UNIQUE,
  name VARCHAR(140) NOT NULL,
  whatsapp_number VARCHAR(24) NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'MXN',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS menu_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  code VARCHAR(100) NOT NULL,
  name VARCHAR(160) NOT NULL,
  price NUMERIC(10,2) NOT NULL CHECK (price >= 0),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (restaurant_id, code)
);

CREATE TABLE IF NOT EXISTS orders (
  order_number BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  restaurant_id UUID NOT NULL REFERENCES restaurants(id),
  order_type VARCHAR(20) NOT NULL CHECK (order_type IN ('delivery', 'dine_in')),
  status VARCHAR(20) NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'accepted', 'preparing', 'on_the_way', 'completed', 'cancelled')),
  customer_name VARCHAR(140) NOT NULL,
  customer_phone VARCHAR(24),
  delivery_address TEXT,
  location_url TEXT,
  delivery_references TEXT,
  table_number VARCHAR(30),
  payment_method VARCHAR(60) NOT NULL,
  cash_change_for VARCHAR(80),
  notes TEXT,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  subtotal NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
  delivery_fee NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (delivery_fee >= 0),
  total NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (total >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orders_restaurant_created
  ON orders (restaurant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_restaurant_status
  ON orders (restaurant_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_restaurant_type
  ON orders (restaurant_id, order_type);

-- Restaurante inicial. Cambia el número por el WhatsApp REAL de Café Neruda,
-- en formato internacional y sin espacios: 52 + lada + número.
INSERT INTO restaurants (slug, name, whatsapp_number)
VALUES ('cafe-neruda', 'Café Neruda', 'REEMPLAZAR_NUMERO_WHATSAPP')
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name;

-- Productos de ejemplo para probar el prototipo. Sustituye estos productos
-- por los nombres, precios y códigos que realmente aparecen en tu menú.
INSERT INTO menu_items (restaurant_id, code, name, price)
SELECT r.id, p.code, p.name, p.price
FROM restaurants r
CROSS JOIN (VALUES
  ('cafe-americano', 'Café americano (EJEMPLO)', 35.00::numeric),
  ('hamburguesa-clasica', 'Hamburguesa clásica (EJEMPLO)', 90.00::numeric),
  ('papas-fritas', 'Papas fritas (EJEMPLO)', 45.00::numeric)
) AS p(code, name, price)
WHERE r.slug = 'cafe-neruda'
ON CONFLICT (restaurant_id, code) DO UPDATE SET
  name = EXCLUDED.name,
  price = EXCLUDED.price,
  active = TRUE;

-- Consulta de comprobación:
-- SELECT r.name, r.whatsapp_number, m.code, m.name, m.price
-- FROM restaurants r LEFT JOIN menu_items m ON m.restaurant_id = r.id
-- WHERE r.slug = 'cafe-neruda';

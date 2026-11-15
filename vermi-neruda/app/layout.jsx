import "./globals.css";

export const metadata = {
  title: "VermiPlato | Pedidos de Café Neruda",
  description: "Panel de administración y recepción de pedidos de Café Neruda."
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}

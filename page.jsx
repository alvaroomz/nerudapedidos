import Link from "next/link";

export default function Home() {
  return (
    <main className="landing">
      <div className="landing-card">
        <div className="brand-mark">VP</div>
        <p className="eyebrow">VERMIPLATO · CAFÉ NERUDA</p>
        <h1>Recepción y administración de pedidos</h1>
        <p>El menú digital puede seguir en tu sitio actual. Este proyecto ofrece el sistema de pedidos y el panel administrativo.</p>
        <Link className="primary-link" href="/pedidos">Abrir panel de pedidos</Link>
      </div>
    </main>
  );
}

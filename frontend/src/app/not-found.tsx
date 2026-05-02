import Link from "next/link";

export default function NotFound() {
  return (
    <main className="auth-shell not-found-shell">
      <section className="auth-panel">
        <div className="auth-heading">
          <span>404</span>
          <h1>Command route not found</h1>
          <p>The admin page you opened is not part of the current operations console.</p>
        </div>
        <Link href="/dashboard" className="primary-action">
          Return to dashboard
        </Link>
      </section>
    </main>
  );
}

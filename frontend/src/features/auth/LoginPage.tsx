"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { ArrowRight, LockKeyhole, ShieldCheck, UserRound } from "lucide-react";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";

export function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState("admin@posticketing.com");
  const [password, setPassword] = useState("admin123");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await login(email, password);
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="auth-shell">
      <section className="auth-visual" aria-hidden="true">
        <div className="auth-grid" />
        <motion.div
          className="auth-bus-card"
          initial={{ opacity: 0, y: 24, rotateX: 10 }}
          animate={{ opacity: 1, y: 0, rotateX: 0 }}
          transition={{ duration: 0.45 }}
        >
          <Image
            src="/assets/bus/blue-aircon/bus-blue-aircon-front-left.png"
            width={520}
            height={360}
            alt=""
            priority
          />
        </motion.div>
        <div className="route-strip">
          <span>FVR Terminal</span>
          <i />
          <span>SM Fairview</span>
          <i />
          <span>Sapang Palay</span>
        </div>
      </section>

      <section className="auth-panel">
        <div className="brand-lockup auth-brand">
          <Image src="/assets/logos/pos-bus-logo.png" width={52} height={52} alt="POS Bus logo" />
          <div>
            <strong>POS BUS</strong>
            <span>Ticketing Command Center</span>
          </div>
        </div>

        <div className="auth-heading">
          <span>
            <ShieldCheck size={16} /> Secure admin access
          </span>
          <h1>Operations login</h1>
          <p>Manage live fleet movement, ticket revenue, routes, and workforce access from one admin console.</p>
        </div>

        <form className="auth-form" onSubmit={onSubmit}>
          <label>
            <span>Email or username</span>
            <div>
              <UserRound size={18} />
              <input value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="username" />
            </div>
          </label>
          <label>
            <span>Password</span>
            <div>
              <LockKeyhole size={18} />
              <input
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                type="password"
                autoComplete="current-password"
              />
            </div>
          </label>
          {error ? <p className="form-error">{error}</p> : null}
          <button className="primary-action" type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Checking access..." : "Secure login"}
            <ArrowRight size={18} />
          </button>
        </form>
      </section>
    </main>
  );
}

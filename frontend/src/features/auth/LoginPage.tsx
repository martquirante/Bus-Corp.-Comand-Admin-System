"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import {
  ArrowRight,
  BarChart3,
  Eye,
  EyeOff,
  LockKeyhole,
  ShieldCheck,
  UserRound,
  UsersRound
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";

const featureChips: Array<{ title: string; detail: string; icon: LucideIcon }> = [
  { title: "Secure Access", detail: "Enterprise-grade security", icon: ShieldCheck },
  { title: "Live Operations", detail: "Real-time fleet insights", icon: BarChart3 },
  { title: "Trusted Platform", detail: "Built for operators", icon: UsersRound }
];

const loginBusImage = "/assets/login/bus-login.png";

export function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
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
    <main className="auth-shell login-command-center">
      <section className="auth-visual" aria-hidden="true">
        <div className="auth-visual-badge">
          <ShieldCheck size={30} />
          <div>
            <strong>COMMAND CENTER</strong>
            <span>Real-time. Reliable. Connected.</span>
          </div>
        </div>
        <motion.div
          className="auth-bus-card"
          initial={{ opacity: 0, y: 28, rotateX: 10 }}
          animate={{ opacity: 1, y: 0, rotateX: 0 }}
          transition={{ duration: 0.55, ease: "easeOut" }}
        >
          <div className="auth-bus-orbit" />
          <Image
            src={loginBusImage}
            width={860}
            height={560}
            alt=""
            className="auth-bus-image"
            priority
          />
          <div className="auth-bus-shadow" />
        </motion.div>

        <div className="auth-feature-chips">
          {featureChips.map((feature) => {
            const Icon = feature.icon;
            return (
              <div className="auth-feature-chip" key={feature.title}>
                <Icon size={26} />
                <span>
                  <strong>{feature.title}</strong>
                  <small>{feature.detail}</small>
                </span>
              </div>
            );
          })}
        </div>
      </section>

      <section className="auth-panel-shell" aria-label="POS BUS admin login">
        <motion.div
          className="auth-panel"
          initial={{ opacity: 0, x: 28 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, ease: "easeOut", delay: 0.08 }}
        >
          <div className="auth-panel-glow" aria-hidden="true" />
          <div className="auth-brand-card">
            <div className="auth-logo-tile">
              <Image src="/assets/logos/pos-bus-logo.png" width={74} height={74} alt="POS Bus logo" priority />
            </div>
            <div>
              <strong>
                POS <span>BUS</span>
              </strong>
              <p>Ticketing Command Center</p>
            </div>
          </div>

          <div className="auth-divider" />

          <div className="auth-heading">
            <span className="auth-secure-label">
              <ShieldCheck size={18} /> Secure admin access
            </span>
            <h1>Operations Login</h1>
            <p>Manage live fleet movement, ticket revenue, routes, and workforce access from one admin console.</p>
          </div>

          <form className="auth-form" onSubmit={onSubmit}>
            <label className="auth-field">
              <span>Email or username</span>
              <div className="auth-input-shell">
                <UserRound size={21} />
                <input
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="username"
                  autoCapitalize="none"
                  placeholder="Enter email or username"
                />
              </div>
            </label>

            <label className="auth-field">
              <span>Password</span>
              <div className="auth-input-shell">
                <LockKeyhole size={21} />
                <input
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  type={isPasswordVisible ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="Enter password"
                />
                <button
                  type="button"
                  className="auth-password-toggle"
                  aria-label={isPasswordVisible ? "Hide password" : "Show password"}
                  aria-pressed={isPasswordVisible}
                  onClick={() => setIsPasswordVisible((current) => !current)}
                >
                  {isPasswordVisible ? <EyeOff size={22} /> : <Eye size={22} />}
                </button>
              </div>
            </label>

            <div className="auth-form-row">
              <label className="auth-remember">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(event) => setRememberMe(event.target.checked)}
                />
                <span>Remember me</span>
              </label>
              <a className="auth-forgot-link" href="/login#forgot-password">
                Forgot password?
              </a>
            </div>

            {error ? <p className="form-error">{error}</p> : null}

            <button className="primary-action auth-submit" type="submit" disabled={isSubmitting}>
              <span>{isSubmitting ? "Checking access..." : "Secure login"}</span>
              <ArrowRight size={24} />
            </button>
          </form>

          <div className="auth-panel-footer">
            <LockKeyhole size={16} />
            <span>All connections are encrypted and secure</span>
          </div>
        </motion.div>
      </section>
    </main>
  );
}

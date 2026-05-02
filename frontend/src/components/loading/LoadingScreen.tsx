"use client";

import Image from "next/image";
import { motion } from "framer-motion";

export function LoadingScreen() {
  return (
    <motion.div
      className="loading-screen"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      aria-live="polite"
    >
      <div className="loading-brand">
        <Image
          src="/assets/logos/pos-bus-logo.png"
          width={72}
          height={72}
          alt="POS Bus logo"
          priority
        />
        <div>
          <strong>POS Bus Command Center</strong>
          <span>Preparing live operations view</span>
        </div>
      </div>
      <div className="loading-route" aria-hidden="true">
        <span className="loading-dot" />
        <span className="loading-line" />
        <motion.span
          className="loading-bus"
          animate={{ x: [0, 210, 0] }}
          transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
        >
          <Image
            src="/assets/bus/blue-aircon/bus-blue-aircon-front-left.png"
            width={88}
            height={58}
            alt=""
          />
        </motion.span>
      </div>
    </motion.div>
  );
}

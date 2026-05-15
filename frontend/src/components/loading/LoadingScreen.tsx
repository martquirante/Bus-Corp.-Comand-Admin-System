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
        <Image
          src="/assets/loading-screen/bus_loading-screen.png"
          width={132}
          height={80}
          alt="Loading bus"
          className="loading-bus-image"
          priority
        />
      </div>
    </motion.div>
  );
}

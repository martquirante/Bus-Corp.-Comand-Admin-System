"use client";

import { useEffect, useRef, useState } from "react";

type AnimatedNumberProps = {
  value: number;
  formatter?: (value: number) => string;
  duration?: number;
};

const defaultFormatter = (value: number) => Math.round(value).toLocaleString("en-PH");

const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function AnimatedNumber({ value, formatter = defaultFormatter, duration = 650 }: AnimatedNumberProps) {
  const [displayValue, setDisplayValue] = useState(value);
  const [changed, setChanged] = useState(false);
  const previousValueRef = useRef(value);

  useEffect(() => {
    const startValue = previousValueRef.current;
    previousValueRef.current = value;
    setChanged(startValue !== value);
    const changeTimer = window.setTimeout(() => setChanged(false), 720);

    if (prefersReducedMotion() || startValue === value) {
      setDisplayValue(value);
      return () => window.clearTimeout(changeTimer);
    }

    let frame = 0;
    let startTime = 0;

    const tick = (timestamp: number) => {
      if (!startTime) startTime = timestamp;

      const progress = Math.min((timestamp - startTime) / duration, 1);
      const easedProgress = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(startValue + (value - startValue) * easedProgress);

      if (progress < 1) {
        frame = window.requestAnimationFrame(tick);
      }
    };

    frame = window.requestAnimationFrame(tick);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(changeTimer);
    };
  }, [duration, value]);

  return <span className={changed ? "animated-number changed" : "animated-number"}>{formatter(displayValue)}</span>;
}

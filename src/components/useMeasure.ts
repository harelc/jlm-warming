import { useLayoutEffect, useRef, useState } from "react";

// Measure an element's width responsively. Measures synchronously on first
// layout (so the chart never paints at a wrong default width and overflows).
export function useMeasure<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    if (!ref.current) return;
    setWidth(ref.current.clientWidth);
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) setWidth(e.contentRect.width);
    });
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return { ref, width };
}

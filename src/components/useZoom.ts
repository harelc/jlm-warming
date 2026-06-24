import { useEffect, useRef, useState } from "react";
import { select, type Selection } from "d3-selection";
import { zoom as d3zoom, zoomIdentity, type ZoomTransform, type ZoomBehavior } from "d3-zoom";

// Attach standard wheel-zoom / drag-pan / pinch (touch) to an SVG via d3-zoom.
// Returns the current transform (apply with transform.rescaleX/Y for crisp
// "semantic" zoom) plus a reset(). Double-click also resets.
export function useZoom(
  svgRef: React.RefObject<SVGSVGElement | null>,
  scaleExtent: [number, number] = [1, 30]
) {
  const [transform, setTransform] = useState<ZoomTransform>(zoomIdentity);
  const ref = useRef<{ sel: Selection<SVGSVGElement, unknown, null, undefined>; z: ZoomBehavior<SVGSVGElement, unknown> } | null>(null);

  useEffect(() => {
    const node = svgRef.current;
    if (!node) return;
    const sel = select<SVGSVGElement, unknown>(node);
    const z = d3zoom<SVGSVGElement, unknown>()
      .scaleExtent(scaleExtent)
      .on("zoom", (e) => setTransform(e.transform));
    sel.call(z).on("dblclick.zoom", null);
    sel.on("dblclick", () => sel.call(z.transform, zoomIdentity));
    ref.current = { sel, z };
    return () => { sel.on(".zoom", null); sel.on("dblclick", null); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [svgRef]);

  const reset = () => ref.current?.sel.call(ref.current.z.transform, zoomIdentity);
  return { transform, reset, zoomed: transform.k !== 1 || transform.x !== 0 || transform.y !== 0 };
}

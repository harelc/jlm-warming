import { useCallback, useRef, useState } from "react";
import { select } from "d3-selection";
import { zoom as d3zoom, zoomIdentity, type ZoomTransform, type ZoomBehavior } from "d3-zoom";

// Standard wheel-zoom / drag-pan / pinch via d3-zoom, exposed as a CALLBACK REF.
// Using a callback ref (not an effect keyed on a ref object) means the zoom
// behavior re-attaches whenever the <svg> node mounts — important because these
// charts conditionally unmount the SVG (e.g. when no years are selected); the
// current transform is restored onto the remounted node so the view persists.
export function useZoom(scaleExtent: [number, number] = [1, 30]) {
  const [transform, setTransform] = useState<ZoomTransform>(zoomIdentity);
  const tRef = useRef<ZoomTransform>(zoomIdentity);
  const attached = useRef<{ node: SVGSVGElement; z: ZoomBehavior<SVGSVGElement, unknown> } | null>(null);

  const setZoomRef = useCallback((node: SVGSVGElement | null) => {
    if (attached.current) {
      select(attached.current.node).on(".zoom", null).on("dblclick", null);
      attached.current = null;
    }
    if (!node) return;
    const sel = select<SVGSVGElement, unknown>(node);
    const z = d3zoom<SVGSVGElement, unknown>()
      .scaleExtent(scaleExtent)
      .on("zoom", (e) => { tRef.current = e.transform; setTransform(e.transform); });
    sel.call(z).on("dblclick.zoom", null);
    sel.on("dblclick", () => sel.call(z.transform, zoomIdentity));
    sel.call(z.transform, tRef.current); // restore current view onto the (re)mounted node
    attached.current = { node, z };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const reset = useCallback(() => {
    if (attached.current) select(attached.current.node).call(attached.current.z.transform, zoomIdentity);
    else { tRef.current = zoomIdentity; setTransform(zoomIdentity); }
  }, []);

  return {
    setZoomRef, transform, reset,
    zoomed: transform.k !== 1 || transform.x !== 0 || transform.y !== 0,
  };
}

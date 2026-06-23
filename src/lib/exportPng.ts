// Serialize an <svg> to a PNG download (paper background, 2× for crispness),
// with a credit strip naming the site and the ירושמיים data source.
export function exportSvgPng(svg: SVGSVGElement, filename: string, caption = "") {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  const w = svg.clientWidth || Number(svg.getAttribute("width")) || 900;
  const h = svg.clientHeight || Number(svg.getAttribute("height")) || 500;
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("width", String(w));
  clone.setAttribute("height", String(h));
  const xml = new XMLSerializer().serializeToString(clone);
  const blob = new Blob([xml], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const strip = 38;
  const img = new Image();
  img.onload = () => {
    const scale = 2;
    const canvas = document.createElement("canvas");
    canvas.width = w * scale;
    canvas.height = (h + strip) * scale;
    const ctx = canvas.getContext("2d")!;
    ctx.scale(scale, scale);
    ctx.fillStyle = "#f7f1e6";
    ctx.fillRect(0, 0, w, h + strip);
    ctx.drawImage(img, 0, 0);
    URL.revokeObjectURL(url);

    // credit strip
    ctx.strokeStyle = "rgba(28,21,15,0.15)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(14, h + 8.5);
    ctx.lineTo(w - 14, h + 8.5);
    ctx.stroke();
    ctx.textBaseline = "middle";
    const ty = h + strip / 2 + 4;
    // credit (always shown, right-aligned) takes priority. Hebrew goes LAST and
    // is wrapped in directional isolates (FSI…PDI) so its RTL run can't reorder
    // the Latin text / digits around it (keeps "02ws.co.il" intact).
    const credit = "jlm-warming.netlify.app  ·  Data: 02ws.co.il / ⁨ירושמיים⁩";
    ctx.font = "12px Archivo, system-ui, sans-serif";
    const creditW = ctx.measureText(credit).width;
    // caption (left), truncated so it never collides with the credit
    if (caption) {
      ctx.fillStyle = "#1c150f";
      ctx.font = "600 12px Archivo, system-ui, sans-serif";
      ctx.textAlign = "left";
      const avail = w - 28 - creditW - 16;
      let text = caption;
      if (ctx.measureText(text).width > avail) {
        while (text.length > 1 && ctx.measureText(text + "…").width > avail) text = text.slice(0, -1);
        text += "…";
      }
      ctx.fillText(text, 14, ty);
    }
    ctx.textAlign = "right";
    ctx.fillStyle = "#9a8f7a";
    ctx.font = "12px Archivo, system-ui, sans-serif";
    ctx.fillText(credit, w - 14, ty);

    canvas.toBlob((png) => {
      if (!png) return;
      const a = document.createElement("a");
      a.href = URL.createObjectURL(png);
      a.download = filename;
      a.click();
      URL.revokeObjectURL(a.href);
    });
  };
  img.src = url;
}

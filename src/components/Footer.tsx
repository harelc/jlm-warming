// Footer with PROMINENT data credit to the ירושמיים (02ws.co.il) station,
// plus the standard license / source / support / counter row.
import { useEffect, useState } from "react";

export function Footer() {
  const [count, setCount] = useState<number | null>(null);
  useEffect(() => {
    const ns = "jlm-warming", key = "visits";
    const seen = sessionStorage.getItem("counted");
    const url = seen
      ? `https://api.counterapi.dev/v1/${ns}/${key}/`
      : `https://api.counterapi.dev/v1/${ns}/${key}/up`;
    fetch(url)
      .then((r) => r.json())
      .then((d) => { setCount(d.count ?? null); sessionStorage.setItem("counted", "1"); })
      .catch(() => {});
  }, []);

  return (
    <footer className="relative z-10 mt-16 border-t border-ink/15 bg-[#efe6d4]/50">
      {/* data credit band — deliberately given real estate, not a footnote */}
      <div className="mx-auto max-w-6xl px-5 py-7">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink/45">
              Data collected &amp; published by
            </div>
            <a href="https://www.02ws.co.il" target="_blank" rel="noopener noreferrer"
              className="group inline-flex items-baseline gap-2">
              <span className="font-heb text-2xl font-black text-ember">ירושמיים</span>
              <span className="font-display text-lg text-ink group-hover:underline">02ws.co.il</span>
            </a>
            <p className="mt-1 max-w-xl text-xs leading-relaxed text-ink/55">
              A private weather station on a Jerusalem rooftop (Boaz Nechemia's Vantage&nbsp;Pro,
              elev.&nbsp;745&nbsp;m), recording daily since 2002. This site only visualizes their data —
              all measurements are theirs. Please visit and support the source.
            </p>
          </div>
          <a href="https://www.02ws.co.il" target="_blank" rel="noopener noreferrer"
            className="shrink-0 rounded-full border border-ember/40 bg-ember/10 px-4 py-2 text-sm font-semibold text-ember transition hover:bg-ember/20">
            Visit ירושמיים →
          </a>
        </div>
      </div>

      <div className="border-t border-ink/10 px-5 py-3 text-center text-xs text-ink/45">
        <span>© {new Date().getFullYear()} Harel Cain</span>
        <span className="mx-2">|</span>
        <a href="https://creativecommons.org/licenses/by-nc-sa/4.0/" target="_blank" rel="noopener noreferrer"
          className="hover:text-ink/70">CC BY-NC-SA 4.0</a>
        <span className="mx-2 hidden sm:inline">|</span>
        <a href="https://github.com/harelc/jlm-warming" target="_blank" rel="noopener noreferrer"
          className="hidden hover:text-ink/70 sm:inline">Source Code</a>
        {count !== null && (
          <>
            <span className="mx-2">|</span>
            <span className="tnum">{count.toLocaleString()} visits</span>
          </>
        )}
      </div>
    </footer>
  );
}

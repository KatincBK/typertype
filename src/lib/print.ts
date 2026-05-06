import { buildHtmlDocument } from "./exportHtml";
import { logger } from "./logger";

// FAZ 13 — Print. Reuses the styled-HTML export pipeline: we render the
// document into a hidden iframe and call print() on its contentWindow.
// That gives the OS print dialog a clean rendering with KaTeX + Mermaid
// already laid out, without leaking any of the editor's chrome / cursor /
// decoration styles into the printed page.
//
// Mermaid renders asynchronously after the iframe loads, so we wait a
// short grace period before printing. A user with a complex deck of
// diagrams may still get them mid-render — the trade-off is responsive
// "Ctrl+P → dialog appears" feedback. If it becomes a real problem we
// can poll for `.mermaid > svg` to land before triggering print.

const MERMAID_RENDER_DELAY_MS = 600;

export async function printDocument(
  markdown: string,
  title: string,
): Promise<void> {
  const html = buildHtmlDocument(markdown, "styled", title);

  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.position = "fixed";
  iframe.style.left = "-10000px";
  iframe.style.top = "0";
  iframe.style.width = "800px";
  iframe.style.height = "600px";
  iframe.style.opacity = "0";
  iframe.style.pointerEvents = "none";

  // Use srcdoc so the iframe inherits no document.cookie / origin oddities
  // and the doc is parsed entirely from our string.
  iframe.srcdoc = html;
  document.body.appendChild(iframe);

  await new Promise<void>((resolve) => {
    let settled = false;
    const onLoad = () => {
      if (settled) return;
      settled = true;
      resolve();
    };
    iframe.addEventListener("load", onLoad, { once: true });
    // Safety net: if `load` never fires for some reason, don't hang forever.
    window.setTimeout(onLoad, 4000);
  });

  // Give Mermaid a chance to render its diagrams.
  await new Promise((r) => window.setTimeout(r, MERMAID_RENDER_DELAY_MS));

  try {
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
  } catch (err) {
    logger.error("print failed", err);
  }

  // Print is modal but closes synchronously when the user dismisses the
  // dialog. We give it a generous tail so any async work the OS spawns
  // (PDF flush, spooler) gets to read from the iframe before we tear it
  // down.
  window.setTimeout(() => iframe.remove(), 2000);
}

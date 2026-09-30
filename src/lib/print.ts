/**
 * printHtml — client util that renders a self-contained HTML document and
 * opens the browser print dialog ("Save as PDF" produces the file).
 *
 * Primary path: hidden iframe (srcdoc) → contentWindow.print().
 * Fallback: new window + document.write (used if the iframe path throws,
 * e.g. some in-app WebViews block iframe printing).
 */

export function printHtml(html: string): void {
  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  Object.assign(iframe.style, {
    position: "fixed",
    inset: "0",
    width: "0",
    height: "0",
    border: "0",
    visibility: "hidden",
  } satisfies Partial<CSSStyleDeclaration>);

  iframe.onload = () => {
    try {
      const win = iframe.contentWindow;
      if (!win) throw new Error("no contentWindow");
      win.focus();
      win.print();
    } catch {
      // Fallback: open a real window (popup blockers may apply).
      const w = window.open("", "_blank");
      if (w) {
        w.document.open();
        w.document.write(html);
        w.document.close();
        w.focus();
        setTimeout(() => {
          try {
            w.print();
          } catch { /* user can print manually */ }
        }, 400);
      }
    }
    // Give the print dialog time to spin up before removing the frame.
    setTimeout(() => iframe.remove(), 60_000);
  };

  iframe.srcdoc = html;
  document.body.appendChild(iframe);
}

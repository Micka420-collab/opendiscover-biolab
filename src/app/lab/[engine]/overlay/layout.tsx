/**
 * Chrome-less segment layout for the OBS browser-source overlay.
 *
 * The root layout owns <html>/<body> (and the site header/footer), so this
 * nested layout can't replace them. Instead it renders a scoped <style> — mounted
 * only on the overlay route — that makes the page background transparent and hides
 * the site chrome, so OBS composites just the result card over the stream.
 */
const OVERLAY_CSS = `
  html, body { background: transparent !important; }
  body > header, body > footer, body > a { display: none !important; }
  main { max-width: none !important; margin: 0 !important; padding: 0 !important; }
`;

export default function OverlayLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <style>{OVERLAY_CSS}</style>
      {children}
    </>
  );
}

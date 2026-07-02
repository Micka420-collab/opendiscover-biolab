/**
 * Chrome-less full-screen layout for the AURORA stream / OBS browser-source view.
 *
 * The root layout owns <html>/<body> and the site header/footer, so this nested layout
 * can't replace them. Instead it renders a scoped <style> — mounted only on this route —
 * that hides the site chrome and lets the AURORA scene fill the whole viewport, so a
 * streamer can add /aurora/overlay as a browser source and capture just the game.
 *
 * Unlike the lab's transparent result-card overlay, AURORA IS the full scene, so the
 * background stays (not transparent); only the site chrome and the content padding go.
 */
const OVERLAY_CSS = `
  body > header, body > footer, body > a { display: none !important; }
  main { max-width: none !important; margin: 0 !important; padding: 0 !important; }
  .aurora-scene { margin: 0 !important; min-height: 100vh !important; }
`;

export default function AuroraOverlayLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <style>{OVERLAY_CSS}</style>
      {children}
    </>
  );
}

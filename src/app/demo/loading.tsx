export default function Loading() {
  return (
    <main id="main" className="demo d-loading" aria-busy="true">
      <h1>Opening the sample workspace</h1>
      <p>No wallet connection is required.</p>
      <div className="d-loading-skeleton" aria-hidden="true" />
      <noscript>
        This interactive demo requires JavaScript. The homepage includes a
        static preview.
      </noscript>
    </main>
  );
}

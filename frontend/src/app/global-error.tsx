"use client";

/**
 * Last-resort boundary for failures in the root layout itself. It replaces
 * the whole document, so it cannot rely on the app's fonts or stylesheet and
 * uses inline styles only.
 */
export default function GlobalError({ reset }: { reset: () => void }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background: "#071120",
          color: "#ffffff",
          fontFamily: "system-ui, sans-serif",
          textAlign: "center",
        }}
      >
        <div>
          <h1 style={{ fontSize: 22, margin: "0 0 8px" }}>
            RoadSafe NZ could not start
          </h1>
          <p style={{ color: "#9ba5b5", fontSize: 14, margin: "0 0 16px" }}>
            Something went wrong before the page could load.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              background: "#ffc72c",
              color: "#071120",
              border: 0,
              borderRadius: 6,
              padding: "10px 16px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}

import React from 'react';
export class RenderBoundary extends React.Component<
  { children: React.ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (this.state.failed)
      return (
        <main className="recovery-page">
          <span className="eyebrow">CARBONX</span>
          <h1>This view needs a refresh.</h1>
          <p>
            The website may have been updated while this tab was open. Your saved records remain on
            the server.
          </p>
          <button className="button primary" onClick={() => window.location.reload()}>
            Reload the website
          </button>
          <a className="text-link" href="/#india">
            Open India observatory
          </a>
        </main>
      );
    return this.props.children;
  }
}

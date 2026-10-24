export default function Loading() {
  return <div className="page-loading" aria-label="Carregando">
    <div className="loading-head">
      <span className="loading-skeleton loading-title"/>
      <span className="loading-skeleton loading-subtitle"/>
    </div>
    <div className="loading-grid">
      {Array.from({ length: 4 }).map((_, index) =>
        <div className="card loading-card" key={index}>
          <span className="loading-skeleton loading-line"/>
          <span className="loading-skeleton loading-number"/>
          <span className="loading-skeleton loading-small"/>
        </div>
      )}
    </div>
    <div className="card loading-panel">
      <span className="loading-skeleton loading-panel-title"/>
      <span className="loading-skeleton loading-row"/>
      <span className="loading-skeleton loading-row"/>
      <span className="loading-skeleton loading-row"/>
    </div>
  </div>;
}

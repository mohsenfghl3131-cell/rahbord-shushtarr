"use client";

export default function ShushtarVisual(){
  return (
    <section className="shushtar-visual">
      <div className="waterfall-photo">
        <img
          src="https://upload.wikimedia.org/wikipedia/commons/1/15/Shushtar_Historical_Hydraulic_System_2.jpg"
          alt="آبشارها و سازه‌های آبی شوشتر"
        />
        <div className="photo-overlay">
          <span>شوشتر</span>
          <b>میراث آب و تمدن</b>
        </div>
      </div>

      <div className="roadman-card">
        <div className="roadman-scene">
          <div className="roadman" aria-label="راهدار در حال پایش گزارش‌ها">
            <div className="roadman-head">
              <span className="helmet">◢</span>
              <span className="face">◉</span>
            </div>
            <div className="roadman-body">
              <span className="vest-line" />
              <span className="badge">R</span>
            </div>
            <span className="arm arm-back" />
            <span className="arm arm-front" />
            <span className="leg leg-left" />
            <span className="leg leg-right" />
            <span className="boot boot-left" />
            <span className="boot boot-right" />
            <span className="search">⌕</span>
          </div>
          <div className="roadman-shadow" />
          <i className="scan-line"/>
          <span className="scan-dot dot-one"/>
          <span className="scan-dot dot-two"/>
        </div>

        <div className="roadman-copy">
          <span className="panel-eyebrow">FIELD SCOUT · ONLINE</span>
          <h3>راهدار در حال پایش</h3>
          <p>در حال جست‌وجوی گزارش‌های جدید در مناطق عملیاتی…</p>
        </div>
      </div>
    </section>
  );
}

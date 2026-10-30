"use client";

export default function ShushtarVisual() {
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

      <div className="radar-card">
        <div className="radar-scene">
          <div className="radar-frame">
            <div className="radar-grid">
              <span className="radar-cross radar-cross-h" />
              <span className="radar-cross radar-cross-v" />
              <span className="radar-ring radar-ring-one" />
              <span className="radar-ring radar-ring-two" />
              <span className="radar-ring radar-ring-three" />
              <span className="radar-sweep" />
              <i className="radar-target target-a" />
              <i className="radar-target target-b" />
              <i className="radar-target target-c" />
              <span className="radar-center" />
            </div>
          </div>
          <div className="radar-status"><i /> سامانه پایش فعال</div>
        </div>
        <div className="radar-copy">
          <span className="panel-eyebrow">AIR DEFENSE · RADAR SYSTEM</span>
          <h3>مرکز پایش و دیده‌بانی</h3>
          <p>پایش لحظه‌ای وضعیت و رصد گزارش‌های مناطق تحت پوشش</p>
        </div>
      </div>
    </section>
  );
}

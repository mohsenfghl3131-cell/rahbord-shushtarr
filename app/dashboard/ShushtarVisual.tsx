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

      <div className="guard-emblem-card" aria-label="راهدار پدافندی">
        <div className="guard-emblem-scene">
          <div className="guard-orbit guard-orbit-one" />
          <div className="guard-orbit guard-orbit-two" />
          <div className="guard-seal">
            <div className="guard-halo" />
            <div className="guard-figure">
              <div className="guard-helmet"><span /></div>
              <div className="guard-face">
                <i className="guard-eye guard-eye-one" />
                <i className="guard-eye guard-eye-two" />
              </div>
              <div className="guard-neck" />
              <div className="guard-shoulders">
                <i className="guard-shoulder-mark" />
                <i className="guard-chest-band" />
                <i className="guard-radio" />
                <i className="guard-badge-mark">ر</i>
              </div>
            </div>
            <span className="guard-seal-star">✦</span>
          </div>
          <div className="guard-signal signal-one" />
          <div className="guard-signal signal-two" />
          <div className="guard-signal signal-three" />
        </div>
        <div className="guard-emblem-copy">
          <span className="panel-eyebrow">RAHBORD · SHUSHTAR</span>
          <h3>راهدار پدافندی</h3>
          <p>آماده‌باش، پایش و هماهنگی حوزه‌ها</p>
          <span className="guard-live"><i /> سامانه فعال</span>
        </div>
      </div>
    </section>
  );
}

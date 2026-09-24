'use client';

import { useCallback, useState } from 'react';
import LivingTypeStage from '@/components/partikel/LivingTypeStage';
import styles from './LivingHome.module.css';

type LivingHomeProps = {
  onCreate: () => void;
  onPreview: () => void;
  reducedMotion?: boolean;
};

/** The landing scene introduces the same line renderer used in the composer. */
export default function LivingHome({ onCreate, onPreview, reducedMotion = false }: LivingHomeProps) {
  const [formed, setFormed] = useState(false);
  const handleComplete = useCallback(() => setFormed(true), []);

  return (
    <section className={styles.home} data-reduced-motion={reducedMotion} aria-label="Particle Message Startseite">
      <div className={styles.axis} aria-hidden="true"><i /><span>PM / 001</span></div>

      <div className={styles.body}>
        <div className={styles.overline}>
          <span className={styles.statusDot} aria-hidden="true" />
          <span>PARTICLE MESSAGE</span>
          <span className={styles.overlineRule} aria-hidden="true" />
          <span>LIVING TYPE / 01</span>
        </div>

        <div className={styles.typeFrame} data-formed={formed}>
          <div className={styles.typeGuides} aria-hidden="true"><i /><i /><i /></div>
          <LivingTypeStage
            text={'Eine Nachricht.\nDein Moment.'}
            engine="line"
            fontFamily="'Avenir Next', Avenir, 'Helvetica Neue', Arial, sans-serif"
            size="large"
            align="left"
            playing
            reducedMotion={reducedMotion}
            onComplete={handleComplete}
            className={styles.stage}
          />
          <h1 className={styles.title} aria-label="Eine Nachricht. Dein Moment.">
            <span>Eine Nachricht.</span>
            <span>Dein <em>Moment.</em></span>
          </h1>
          <span className={styles.frameIndex} aria-hidden="true">01 — 02</span>
        </div>

        <div className={styles.afterword}>
          <p className={styles.description}>Eine Linie wird zu Worten. Worte werden zu einem Moment, den du teilen kannst.</p>
          <div className={styles.actions}>
            <button className={styles.create} type="button" onClick={onCreate}>
              <span>Nachricht erstellen</span><span aria-hidden="true">↗</span>
            </button>
            <button className={styles.preview} type="button" onClick={onPreview}>
              <span className={styles.playIcon} aria-hidden="true">▶</span> Erlebnis ansehen
            </button>
          </div>
        </div>

        <div className={styles.footer} aria-hidden="true">
          <span>LINIE</span><i /><span>FORM</span><i /><span>BEDEUTUNG</span>
          <span className={styles.footerEnd}>FÜR EINEN MENSCHEN. ALS LINK GETEILT.</span>
        </div>
      </div>

      <aside className={styles.annotation} aria-hidden="true">
        <span className={styles.annotationTop}>ANIMATIONSSTUDIE<br />NO. 01</span>
        <div className={styles.annotationLine}><i /><i /><i /></div>
        <span className={styles.annotationTitle}>LINE<br />MORPH</span>
        <span className={styles.annotationCaption}>EINE BEWEGUNG<br />VIELE FORMEN</span>
      </aside>
    </section>
  );
}

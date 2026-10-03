import { useLayoutEffect, useRef } from 'react';
import Counter from './reactbits/Counter.jsx';

const places = [10, 1];
const minuteRadices = [6, 10];
const hourRadices = [3, 10];
const pad = value => String(value).padStart(2, '0');
const counterProps = {
  fontSize: 16,
  padding: 2,
  places,
  gap: 0,
  borderRadius: 0,
  horizontalPadding: 0,
  gradientHeight: 0,
  gradientFrom: '#000',
  gradientTo: 'transparent',
  textColor: 'inherit',
  containerStyle: { display: 'inline-flex' },
  topGradientStyle: { display: 'none' },
  bottomGradientStyle: { display: 'none' }
};

/** The source clock is owned by the market/replay transport, never by this UI. */
export default function MarketClock({ timestamp, rate = 1, replay = false, seeking = false, label }) {
  const previous = useRef(null);
  const validInput = timestamp != null && Number.isFinite(Number(timestamp));
  const date = validInput ? new Date(Number(timestamp)) : null;
  const valid = date && Number.isFinite(date.getTime());
  const second = valid ? Math.floor(date.getTime() / 1000) : null;
  // These targets remain continuous through 59 → 00. Individual wheels use
  // their own radix, preserving the upstream spring and rolling digit effect.
  const localSecond = valid ? second - date.getTimezoneOffset() * 60 : null;
  const hours = valid ? date.getHours() : 0;
  const minutes = valid ? date.getMinutes() : 0;
  const seconds = valid ? date.getSeconds() : 0;
  const formatted = valid ? `${pad(hours)}:${pad(minutes)}:${pad(seconds)}` : '--:--:--';
  const prior = previous.current;
  const delta = valid && prior ? second - prior.second : null;
  const speed = Number(rate);
  // Adjacent real-time/2x ticks can roll. A seek or accelerated playback must
  // show its current time immediately rather than count through omitted time.
  const animate = Boolean(
    valid && prior && !seeking && !prior.seeking &&
    replay === prior.replay && speed > 0 && speed <= 2 && prior.rate === speed &&
    delta >= 0 && delta <= 1 && localSecond - prior.localSecond === delta
  );
  const animateHours = animate && !(prior.hours === 23 && hours === 0);

  useLayoutEffect(() => {
    previous.current = valid ? { second, localSecond, hours, rate: speed, replay, seeking } : null;
  }, [valid, second, localSecond, hours, speed, replay, seeking]);

  return (
    <span
      className="market-clock"
      role="timer"
      aria-live="off"
      aria-atomic="true"
      aria-label={`${label || (replay ? 'Playback time' : 'Local time')}: ${formatted}`}
      style={{ display: 'inline-flex', alignItems: 'center', fontVariantNumeric: 'tabular-nums' }}
    >
      <span aria-hidden="true" style={{ display: 'inline-flex', alignItems: 'center', gap: 1 }}>
        {valid ? <>
          <Counter {...counterProps} value={hours} radices={hourRadices} animate={animateHours} />
          <span>:</span>
          <Counter
            {...counterProps}
            value={minutes}
            radices={minuteRadices}
            wheelValues={[Math.floor(localSecond / 600), Math.floor(localSecond / 60)]}
            animate={animate}
          />
          <span>:</span>
          <Counter
            {...counterProps}
            value={seconds}
            radices={minuteRadices}
            wheelValues={[Math.floor(localSecond / 10), localSecond]}
            animate={animate}
          />
        </> : formatted}
      </span>
    </span>
  );
}

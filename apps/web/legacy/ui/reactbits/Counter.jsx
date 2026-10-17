'use client';

import { motion, useReducedMotion, useSpring, useTransform } from 'motion/react';
import { useLayoutEffect } from 'react';

import './Counter.css';

// $UPIC adaptation: optional radices and unwrapped wheel targets allow this
// upstream decimal odometer to display a clock without spinning 59 back to 00.
function Number({ mv, number, height, radix }) {
  let y = useTransform(mv, latest => {
    let placeValue = ((latest % radix) + radix) % radix;
    let offset = (radix + number - placeValue) % radix;
    let memo = offset * height;
    if (offset > radix / 2) {
      memo -= radix * height;
    }
    return memo;
  });
  return (
    <motion.span className="counter-number" style={{ y }}>
      {number}
    </motion.span>
  );
}

function normalizeNearInteger(num) {
  const nearest = Math.round(num);
  const tolerance = 1e-9 * Math.max(1, Math.abs(num));
  return Math.abs(num - nearest) < tolerance ? nearest : num;
}

function getValueRoundedToPlace(value, place) {
  const scaled = value / place;
  return Math.floor(normalizeNearInteger(scaled));
}

function Digit({ place, value, height, digitStyle, radix = 10, wheelValue, animate = true }) {
  const reduce = useReducedMotion();
  const isDecimal = place === '.';
  const valueRoundedToPlace = isDecimal ? 0 : wheelValue ?? getValueRoundedToPlace(value, place);
  const animatedValue = useSpring(valueRoundedToPlace);

  useLayoutEffect(() => {
    if (!isDecimal) {
      if (animate && !reduce) animatedValue.set(valueRoundedToPlace);
      else animatedValue.jump(valueRoundedToPlace);
    }
  }, [animatedValue, valueRoundedToPlace, isDecimal, animate, reduce]);

  if (isDecimal) {
    return (
      <span className="counter-digit" style={{ height, ...digitStyle, width: 'fit-content' }}>
        .
      </span>
    );
  }

  return (
    <span className="counter-digit" style={{ height, ...digitStyle }}>
      {Array.from({ length: radix }, (_, i) => (
        <Number key={i} mv={animatedValue} number={i} height={height} radix={radix} />
      ))}
    </span>
  );
}

export default function Counter({
  value,
  fontSize = 100,
  padding = 0,
  places = [...value.toString()].map((ch, i, a) => {
    ch == '.';
    if (ch === '.') {
      return '.';
    } else {
      return (
        10 **
        (a.indexOf('.') === -1 ? a.length - i - 1 : i < a.indexOf('.') ? a.indexOf('.') - i - 1 : -(i - a.indexOf('.')))
      );
    }
  }),
  radices,
  wheelValues,
  animate = true,
  gap = 8,
  borderRadius = 4,
  horizontalPadding = 8,
  textColor = 'inherit',
  fontWeight = 'inherit',
  containerStyle,
  counterStyle,
  digitStyle,
  gradientHeight = 16,
  gradientFrom = 'black',
  gradientTo = 'transparent',
  topGradientStyle,
  bottomGradientStyle
}) {
  const height = fontSize + padding;
  const defaultCounterStyle = {
    fontSize,
    gap: gap,
    borderRadius: borderRadius,
    paddingLeft: horizontalPadding,
    paddingRight: horizontalPadding,
    color: textColor,
    fontWeight: fontWeight,
    direction: "ltr"
  };
  const defaultTopGradientStyle = {
    height: gradientHeight,
    background: `linear-gradient(to bottom, ${gradientFrom}, ${gradientTo})`
  };
  const defaultBottomGradientStyle = {
    height: gradientHeight,
    background: `linear-gradient(to top, ${gradientFrom}, ${gradientTo})`
  };
  return (
    <span className="counter-container" style={containerStyle}>
      <span className="counter-counter" style={{ ...defaultCounterStyle, ...counterStyle }}>
        {places.map((place, index) => (
          <Digit
            key={place}
            place={place}
            value={value}
            height={height}
            digitStyle={digitStyle}
            radix={radices?.[index] ?? 10}
            wheelValue={wheelValues?.[index]}
            animate={animate}
          />
        ))}
      </span>
      <span className="gradient-container">
        <span className="top-gradient" style={topGradientStyle ? topGradientStyle : defaultTopGradientStyle}></span>
        <span
          className="bottom-gradient"
          style={bottomGradientStyle ? bottomGradientStyle : defaultBottomGradientStyle}
        ></span>
      </span>
    </span>
  );
}

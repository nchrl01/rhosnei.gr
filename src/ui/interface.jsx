import React, { Component, useEffect, useLayoutEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import CometDial from './reactbits/CometDial.jsx';
import LatticeLoader from './reactbits/LatticeLoader.jsx';
import MarketClock from './MarketClock.jsx';

function reportFailure(host, component, error) {
  host.dataset.failed = 'true';
  const EventClass = host.ownerDocument.defaultView.CustomEvent;
  host.dispatchEvent(new EventClass('ui-component-error', {
    bubbles: true,
    detail: { component, message: error?.message || String(error) }
  }));
}

class IslandBoundary extends Component {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error) {
    reportFailure(this.props.host, this.props.component, error);
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

function createIsland(host, component) {
  let root;
  let disposed = false;
  try {
    root = createRoot(host);
  } catch (error) {
    reportFailure(host, component, error);
    throw error;
  }
  return {
    available: Boolean(root),
    render(children, key = component) {
      if (!root || disposed) return;
      try {
        root.render(children == null ? null : (
          <IslandBoundary key={key} host={host} component={component}>
            {children}
          </IslandBoundary>
        ));
      } catch (error) {
        reportFailure(host, component, error);
      }
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      try {
        root?.unmount();
      } catch (error) {
        reportFailure(host, component, error);
      }
    }
  };
}

const clampPercent = value => Math.max(0, Math.min(100, Number(value) || 0));
const readVolume = input => clampPercent(Number(input.value) * 100);

function focusDial(host) {
  if (host.hidden) return false;
  const target = host.querySelector('[role="slider"]');
  if (!target) return false;
  target.focus({ preventScroll: true });
  return host.ownerDocument.activeElement === target;
}

function VolumeIsland({ host, input }) {
  const [value, setValue] = useState(() => readVolume(input));

  useLayoutEffect(() => {
    const sync = () => setValue(readVolume(input));
    input.addEventListener('input', sync);
    input.addEventListener('change', sync);
    sync();
    focusDial(host);
    return () => {
      input.removeEventListener('input', sync);
      input.removeEventListener('change', sync);
    };
  }, [host, input]);

  const dispatch = type => {
    const EventClass = input.ownerDocument.defaultView.Event;
    input.dispatchEvent(new EventClass(type, { bubbles: true }));
  };
  const change = next => {
    const level = Math.round(clampPercent(next));
    input.value = String(level / 100);
    setValue(level);
    dispatch('input');
  };
  const finish = next => {
    const level = Math.round(clampPercent(next));
    if (Number(input.value) !== level / 100) change(level);
    dispatch('change');
  };

  return (
    <CometDial
      value={value}
      defaultValue={value}
      min={0}
      max={100}
      step={1}
      unit="%"
      label="Volume"
      accent="#f5f5f5"
      ink="#fdfdfd"
      size={250}
      sweep={320}
      thickness={5}
      speed={25}
      tapBounce={0.2}
      flickBounce={0.1}
      momentum={1}
      cometReach={180}
      cometWidth={12}
      onChange={change}
      onChangeEnd={finish}
      disabled={false}
    />
  );
}

export function mountVolume(host, input) {
  const island = createIsland(host, 'volume');
  let open = false;
  let disposed = false;
  host.hidden = true;
  return {
    setOpen(next) {
      if (disposed) return;
      const visible = Boolean(next);
      if (visible === open) return;
      open = visible;
      host.hidden = !open;
      if (open && island.available) delete host.dataset.failed;
      island.render(open ? <VolumeIsland host={host} input={input} /> : null);
    },
    focus() {
      return !disposed && open && focusDial(host);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      open = false;
      host.hidden = true;
      island.dispose();
    }
  };
}

function LoaderIsland({ state }) {
  const [now, setNow] = useState(() => performance.now());
  useEffect(() => {
    if (state.status !== 'working') return undefined;
    setNow(performance.now());
    const timer = setInterval(() => setNow(performance.now()), 100);
    return () => clearInterval(timer);
  }, [state.status, state.startedAt]);
  const end = state.status === 'working' ? now : state.endedAt;
  const elapsed = Math.max(0, (end - state.startedAt) / 1000);
  return (
    <LatticeLoader
      status={state.status}
      label={state.label}
      doneLabel="Done in"
      errorLabel="Failed after"
      pattern="orbit"
      grid={3}
      shape="round"
      doneColor="#22c55e"
      errorColor="#ef4444"
      cellSize={6}
      gap={2}
      fontSize={14}
      step={90}
      idleOpacity={0.15}
      glow={false}
      glowColor=""
      showTimer
      color="#f5f5f5"
      elapsed={elapsed}
    />
  );
}

export function mountLoader(host) {
  const island = createIsland(host, 'loading');
  let disposed = false;
  let previous = null;
  host.hidden = true;
  return {
    update(value) {
      if (disposed) return;
      host.hidden = value == null;
      if (value == null) {
        previous = null;
        island.render(null);
        return;
      }
      const now = performance.now();
      const operation = String(value.operation ?? 'loading');
      const sameOperation = previous?.operation === operation;
      const status = ['working', 'done', 'error'].includes(value.status) ? value.status : 'working';
      const startedAt = Number.isFinite(value.startedAt)
        ? value.startedAt
        : sameOperation ? previous.startedAt : now;
      const endedAt = status === 'working' ? null : Number.isFinite(value.endedAt)
        ? value.endedAt
        : sameOperation && previous.endedAt != null ? previous.endedAt : now;
      const state = { operation, status, startedAt, endedAt, label: String(value.label || 'Loading') };
      if (!sameOperation && island.available) delete host.dataset.failed;
      previous = state;
      island.render(<LoaderIsland key={operation} state={state} />, operation);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      previous = null;
      host.hidden = true;
      island.dispose();
    }
  };
}

export function mountClock(host) {
  const island = createIsland(host, 'clock');
  let disposed = false;
  return {
    update(props) {
      if (disposed) return;
      island.render(<MarketClock {...props} />);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      island.dispose();
    }
  };
}

# OSC carries only public market observations from the local UPIC preview.
import json
import math

def onReceiveOSC(dat, rowIndex, message, bytes, timeStamp, address, args, peer):
    if address != '/upic/frame' or not args:
        return
    try:
        frame = json.loads(args[0])
        if frame.get('version') != 1:
            return
        root = parent()
        now = absTime.seconds
        before = root.fetch('frame', {})
        active = frame.get('running', 0) == 1
        root.store('frame', frame)
        root.store('received', now)
        trace = frame.get('trace', [])
        prices = [math.log(row[0]) for row in trace if row[0] is not None and row[0] > 0]
        low, high = (min(prices), max(prices)) if prices else (0, 0)
        volumes = [row[1] for row in trace if row[1] is not None and row[1] >= 0]
        peak = max(volumes) if volumes else 0
        profile, flow = [], []
        for i in range(8):
            row = trace[round(i*(len(trace)-1)/7)] if trace else [None, None]
            price, volume = row
            profile.append(((math.log(price)-low)/(high-low) if high>low else .5) if price is not None and price>0 else -1)
            flow.append((math.log1p(volume)/math.log1p(peak) if peak>0 else 0) if volume is not None and volume>=0 else -1)
        # Keep one composition per coin and retain its last image on pause or
        # stale data. Public observations below remain exact; only the visual
        # values use a 420 ms response to avoid abrupt density/position changes.
        visual = root.fetch('visual', {})
        if active:
            same_coin = visual and visual.get('seed') == frame.get('seed')
            elapsed = min(.25, max(0, now-root.fetch('visual_updated', now)))
            if before.get('running') != 1:
                elapsed = min(elapsed, .08)
            alpha = 1-math.exp(-elapsed/.42) if same_coin else 1
            target = dict(frame)
            for key in ['intensity', 'volume', 'motion', 'balance', 'pressure',
                        'turnover', 'volumeRatio', 'price', 'marketCap',
                        'liquidity', 'tradeRate']:
                old, value = visual.get(key), frame.get(key)
                if isinstance(old, (int, float)) and isinstance(value, (int, float)):
                    target[key] = old+(value-old)*alpha
            for key, values in [('profile', profile), ('flow', flow)]:
                previous = visual.get(key, [-1]*8)
                target[key] = [old+(value-old)*alpha if old>=0 and value>=0 else value
                               for old, value in zip(previous, values)]
            root.store('visual', target)
            root.store('visual_updated', now)
        table = root.op('observations')
        table.clear()
        table.appendRow(['measurement', 'value'])
        for name, value in frame.items():
            if name != 'trace':
                table.appendRow([name, 'unavailable' if value is None else value])
        history = root.op('history')
        history.clear()
        history.appendRow(['price', 'volume'])
        for row in frame.get('trace', []):
            history.appendRow(['unavailable' if x is None else x for x in row])
    except (ValueError, TypeError, KeyError):
        pass
    return

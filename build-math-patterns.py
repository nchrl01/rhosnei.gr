"""Generate the vanilla Pd audio voices controlled by AV's math-pattern clock.

JavaScript chooses the seeded pattern, phrase rests and continuously sampled
envelope. Pd produces and measures the sound from those same controls. No
independent sequencer or clock runs in these patches.
"""
from pathlib import Path
import sys

BASE = Path(__file__).resolve().parent
sys.path.insert(0, str(BASE / 'native' / 'perc-generator'))
import pd_patch

pd_patch.ROOT = BASE / 'public' / 'patches' / 'orchestra'
pd_patch.ROOT.mkdir(parents=True, exist_ok=True)


def control(patch, name, low, high, ms, x, y):
    receive = patch.obj(r'r math-\$1-' + name, x, y)
    limit = patch.obj(f'clip {low} {high}', x, y + 35)
    ramp = patch.obj(f'pack f {ms}', x, y + 70)
    signal = patch.obj('line~', x, y + 105)
    patch.chain(receive, limit, ramp, signal)
    return signal, ramp


p = pd_patch.Patch('Math voice / market envelope -> vanilla Pd synthesis', 1380, 970)
p.text('Creation argument = voice index. The browser supplies the audible envelope and phrase rests.', 25, 40)
pitch = p.obj(r'r math-\$1-pitch', 25, 90)
pitch_clip = p.obj('clip 24 84', 25, 125)
mtof = p.obj('mtof', 25, 160)
pitch_ramp = p.obj('pack f 25', 25, 195)
frequency = p.obj('line~', 25, 230)
p.chain(pitch, pitch_clip, mtof, pitch_ramp, frequency)

# Finite harmonic bank keeps high notes free of a naive saw's aliased edges.
# Its absolute sum is bounded by one before the drive stage.
fundamental = p.obj('osc~', 25, 285)
p.link(frequency, fundamental)
partials = []
for harmonic, weight, x in [(2, 0.4, 160), (3, 0.2, 295), (4, 0.1, 430)]:
    multiply = p.obj(f'*~ {harmonic}', x, 285)
    oscillator = p.obj('osc~', x, 320)
    gain = p.obj(f'*~ {weight}', x, 355)
    p.chain(frequency, multiply, oscillator, gain)
    partials.append(gain)
sum_a = p.obj('+~', 160, 405)
sum_b = p.obj('+~', 295, 440)
sum_c = p.obj('+~', 430, 475)
p.link(fundamental, sum_a)
p.link(partials[0], sum_a, inp=1)
p.link(sum_a, sum_b)
p.link(partials[1], sum_b, inp=1)
p.link(sum_b, sum_c)
p.link(partials[2], sum_c, inp=1)
normalize = p.obj('*~ 0.588235', 430, 510)
p.chain(sum_c, normalize)

shape, _ = control(p, 'shape', 0, 1, 40, 575, 90)
blend = p.obj('expr~ $v1*(1-$v3)+$v2*$v3', 25, 550)
p.link(fundamental, blend)
p.link(normalize, blend, inp=1)
p.link(shape, blend, inp=2)
drive, _ = control(p, 'drive', 1, 3, 40, 740, 90)
saturate = p.obj('expr~ tanh($v1*$v2)/(tanh($v2)+0.000001)', 25, 590)
p.link(blend, saturate)
p.link(drive, saturate, inp=1)

# lop~ uses a control inlet: line (not line~) keeps cutoff movement smooth.
cutoff = p.obj(r'r math-\$1-cutoff', 575, 285)
cutoff_clip = p.obj('clip 150 5000', 575, 320)
cutoff_ramp = p.obj('pack f 40', 575, 355)
cutoff_line = p.obj('line', 575, 390)
p.chain(cutoff, cutoff_clip, cutoff_ramp, cutoff_line)
lowpass = p.obj('lop~ 900', 25, 630)
highpass = p.obj('hip~ 25', 25, 665)
p.chain(saturate, lowpass, highpass)
p.link(cutoff_line, lowpass, inp=1)

level, level_ramp = control(p, 'level', 0, 0.4, 60, 915, 90)
gate, gate_ramp = control(p, 'gate', 0, 1, 15, 1100, 90)
envelope = p.obj('*~', 25, 705)
gain = p.obj('*~', 25, 740)
p.chain(highpass, envelope, gain)
p.link(gate, envelope, inp=1)
p.link(level, gain, inp=1)

run = p.obj('r run', 740, 285)
run_clip = p.obj('clip 0 1', 740, 320)
run_ramp = p.obj('pack f 15', 740, 355)
run_line = p.obj('line~', 740, 390)
run_off = p.obj('sel 0', 915, 320)
p.chain(run, run_clip, run_ramp, run_line)
p.chain(run, run_off)
seed = p.obj('r seed', 1100, 285)
load = p.obj('loadbang', 1100, 355)
clear = p.msg('0', 915, 435)
p.chain(run_off, clear)
p.chain(seed, clear)
p.chain(load, clear)
p.link(clear, gate_ramp)
p.link(clear, level_ramp)

# Pd's scheduler keeps watching even when the page's control timer stalls.
# A new gate message first cancels the pending timeout, then starts a fresh one.
heartbeat = p.obj(r'r math-\$1-gate', 575, 730)
restart = p.obj('t b b', 575, 765)
watchdog_stop = p.msg('stop', 740, 800)
watchdog = p.obj('delay 400', 575, 835)
watchdog_zero = p.msg('0', 575, 870)
p.chain(heartbeat, restart)
p.link(restart, watchdog_stop, out=1)
p.link(watchdog_stop, watchdog)
p.link(restart, watchdog)
p.chain(watchdog, watchdog_zero, gate_ramp)
p.link(clear, watchdog_stop)

# Initialize non-envelope controls so normalization never divides by zero.
# Both audible gains and the run gate still start at zero.
drive_default = p.msg('1', 1100, 435)
drive_default_send = p.obj(r's math-\$1-drive', 1100, 470)
p.chain(load, drive_default, drive_default_send)
master = p.obj('*~', 25, 780)
trim = p.obj('*~ 0.55', 25, 815)
outlet = p.obj('outlet~', 25, 910)
p.chain(gain, master, trim, outlet)
p.link(run_line, master, inp=1)
meter = p.obj('env~ 1024 512', 250, 815)
decibels = p.obj('- 100', 250, 850)
meter_send = p.obj(r's math-\$1-meter', 250, 885)
p.chain(trim, meter, decibels, meter_send)
p.text('Measured output RMS dB: -100 = silence. Maximum level 0.4 x trim 0.55.', 575, 630)
p.text('Seed changes and run=0 clear the envelope. A voice needs new market controls to sound again.', 575, 665)
p.text('No gate updates for 400 ms -> fade to silence in 15 ms.', 575, 700)
p.write('av-math-voice')

p = pd_patch.Patch('Two seed-selected market math voices / stereo sum', 940, 480)
p.text('Each voice is clocked by browser audio time and reports its measured output.', 25, 45)
voice_a = p.obj('av-math-voice 0', 80, 110)
voice_b = p.obj('av-math-voice 1', 420, 110)
# Gentle opposite pans preserve both identities in mono and keep ample headroom.
left_a = p.obj('*~ 0.82', 80, 185)
right_a = p.obj('*~ 0.57', 230, 185)
left_b = p.obj('*~ 0.57', 420, 185)
right_b = p.obj('*~ 0.82', 570, 185)
p.chain(voice_a, left_a)
p.chain(voice_a, right_a)
p.chain(voice_b, left_b)
p.chain(voice_b, right_b)
left = p.obj('+~', 180, 290)
right = p.obj('+~', 480, 290)
p.link(left_a, left)
p.link(left_b, left, inp=1)
p.link(right_a, right)
p.link(right_b, right, inp=1)
p.chain(left, p.obj('outlet~', 180, 390))
p.chain(right, p.obj('outlet~', 480, 390))
p.write('av-math')

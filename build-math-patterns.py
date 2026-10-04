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


p = pd_patch.Patch('Math voice / market envelope -> vanilla Pd synthesis', 2300, 970)
p.text('Creation argument = voice index. The browser supplies the audible envelope and phrase rests.', 25, 40)
pitch = p.obj(r'r math-\$1-pitch', 25, 90)
pitch_clip = p.obj('clip 24 84', 25, 125)
mtof = p.obj('mtof', 25, 160)
pitch_ramp = p.obj('pack f 6', 25, 195)
frequency = p.obj('line~', 25, 230)
p.chain(pitch, pitch_clip, mtof, pitch_ramp, frequency)

# PolyBLEP saws round each phase discontinuity over one sample on either side.
# The sample rate is read from Pd; the positive default protects startup division.
sample_load = p.obj('loadbang', 300, 90)
sample_rate = p.obj('samplerate~', 300, 125)
sample_signal = p.obj('sig~ 44100', 300, 160)
p.chain(sample_load, sample_rate, sample_signal)


def saw(patch, hz, x, y):
    phase = patch.obj('phasor~', x, y)
    step = patch.obj('/~', x + 135, y)
    safe_step = patch.obj('clip~ 0.000001 0.49', x + 135, y + 35)
    wave = patch.obj(r'expr~ 2*$v1-1-if($v1<$v2 \, 2*($v1/$v2)-pow($v1/$v2 \, 2)-1 \, if($v1>1-$v2 \, pow(($v1-1)/$v2 \, 2)+2*(($v1-1)/$v2)+1 \, 0))', x, y + 75)
    patch.link(hz, phase)
    patch.chain(hz, step, safe_step)
    patch.link(sample_signal, step, inp=1)
    patch.link(phase, wave)
    patch.link(safe_step, wave, inp=1)
    return wave


blend = saw(p, frequency, 25, 285)
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
gate, gate_ramp = control(p, 'gate', 0, 1, 4, 1100, 90)
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
# The two reel cowbell functions have a separate mathematical pitch line.
# It shares the phrase level, run gate, reset and watchdog with its main voice.
aux_pitch = p.obj(r'r math-\$1-aux-pitch', 1280, 90)
aux_clip = p.obj('clip 24 96', 1280, 125)
aux_mtof = p.obj('mtof', 1280, 160)
aux_ramp = p.obj('pack f 12', 1280, 195)
aux_frequency = p.obj('line~', 1280, 230)
p.chain(aux_pitch, aux_clip, aux_mtof, aux_ramp, aux_frequency)
aux_a = saw(p, aux_frequency, 1280, 285)
aux_ratio = p.obj('*~ 1.48', 1410, 240)
p.link(aux_frequency, aux_ratio)
aux_b = saw(p, aux_ratio, 1800, 285)
aux_sum = p.obj('+~', 1280, 390)
aux_trim = p.obj('*~ 0.11', 1410, 390)
p.chain(aux_a, aux_sum, aux_trim)
p.link(aux_b, aux_sum, inp=1)
aux_gate, aux_gate_ramp = control(p, 'aux-gate', 0, 1, 8, 1520, 90)
aux_envelope = p.obj('*~', 1280, 435)
aux_gain = p.obj('*~', 1280, 470)
p.chain(aux_trim, aux_envelope, aux_gain)
p.link(aux_gate, aux_envelope, inp=1)
p.link(level, aux_gain, inp=1)
p.link(clear, aux_gate_ramp)
p.link(watchdog_zero, aux_gate_ramp)
combined = p.obj('+~', 1280, 515)
p.link(gain, combined)
p.link(aux_gain, combined, inp=1)
master = p.obj('*~', 25, 780)
trim = p.obj('*~ 0.55', 25, 815)
outlet = p.obj('outlet~', 25, 910)
p.chain(combined, master, trim, outlet)
p.link(run_line, master, inp=1)
meter = p.obj('env~ 1024 512', 250, 815)
decibels = p.obj('- 100', 250, 850)
meter_send = p.obj(r's math-\$1-meter', 250, 885)
p.chain(trim, meter, decibels, meter_send)
p.text('Measured output RMS dB: -100 = silence. Maximum level 0.4 x trim 0.55.', 575, 630)
p.text('Seed changes and run=0 clear the envelope. A voice needs new market controls to sound again.', 575, 665)
p.text('No gate updates for 400 ms -> fade to silence in 4 ms.', 575, 700)
p.write('av-math-voice')

p = pd_patch.Patch('Five seed-selected market math voices / stereo sum', 1450, 680)
p.text('Each voice is clocked by browser audio time and reports its measured output.', 25, 45)
left = p.obj('+~', 240, 490)
right = p.obj('+~', 640, 490)
# Five fixed pans. Browser gains share headroom across the unlocked voices.
for slot, (left_gain, right_gain) in enumerate([(0.82, 0.57), (0.57, 0.82), (0.75, 0.66), (0.66, 0.75), (0.707, 0.707)]):
    x = 50 + slot * 275
    voice = p.obj(f'av-math-voice {slot}', x, 110)
    l = p.obj(f'*~ {left_gain}', x, 210)
    r = p.obj(f'*~ {right_gain}', x + 100, 275)
    p.chain(voice, l, left)
    p.chain(voice, r, right)
p.chain(left, p.obj('outlet~', 240, 590))
p.chain(right, p.obj('outlet~', 640, 590))
p.write('av-math')

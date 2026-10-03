# Execute inside TouchDesigner, against its real OSC callback and GLSL output.
import json
from pathlib import Path
base = op('/project1/upic_data_score')
g = base.op('data_field')
callback = base.op('osc_callbacks').module.onReceiveOSC
sample = dict(version=1, sequence=1, word=8766, seed=1917, running=1, replay=0,
    voice=2, intensity=.8, activity=.9, volume=.7, motion=.6, pressure=.8,
    balance=.6, fresh=1, price=.003, marketCap=3000000, liquidity=200000,
    tradeRate=3, change=25, volumeRatio=4, turnover=.3, holders=None,
    source='observed swaps', trace=[[.002,4000],[.003,12000]])
base.store('frame', {}); base.store('visual', {}); base.store('visual_updated', -1000)
def deliver(frame):
    callback(base.op('market_in'), 0, '', b'', 0, '/upic/frame', [json.dumps(frame)], None)
    g.cook(force=True)
    return g.numpyArray(delayed=False)
initial=deliver(sample)
assert initial is not None and initial[:,:,:3].min()<.5, 'Initial observation must remain visible'
sample['sequence']=2
observed=deliver(sample).copy()
coverage=float((observed[:,:,0]<.5).mean())
assert .001<coverage<.3, ('Expected a bounded marked field',coverage)
g.save('/Users/nikoscharalampous/$AV/touchdesigner/preview.png')
base.store('received', absTime.seconds-2)
g.cook(force=True)
assert abs(g.numpyArray(delayed=False)-observed).max()<1e-6, 'Stalled input must retain the last image'
sample['running']=0
deliver(sample)
assert abs(g.numpyArray(delayed=False)-observed).max()<1e-6, 'Paused output must retain the last image'
base.store('frame', {}); base.store('visual', {}); base.store('visual_updated', -1000); base.store('received', -1000)
base.op('observations').clear(); base.op('observations').appendRow(['measurement','value']); base.op('observations').appendRow(['source','waiting for local UPIC preview'])
base.op('history').clear(); base.op('history').appendRow(['price','volume'])
base.save('/Users/nikoscharalampous/$AV/touchdesigner/UPIC-data-score.tox')
print('UPIC render verified: ink coverage',coverage,'baseline visible; idle/pause retain image; saved component.')

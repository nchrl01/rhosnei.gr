# Run in TouchDesigner's Python Textport. Creates a self-contained component.
from pathlib import Path
ROOT = Path('/Users/nikoscharalampous/$AV/touchdesigner')
base = op('/project1/upic_data_score')
if base is None:
    base = op('/project1').create(baseCOMP, 'upic_data_score')
base.store('frame', {})
base.store('burst', -1000)
base.store('received', -1000)
base.store('profile', [-1]*8)
base.store('flow', [-1]*8)
def node(kind, name):
    return base.op(name) or base.create(kind, name)
shader = node(textDAT, 'fragment')
shader.text = (ROOT/'data_field.frag').read_text()
callbacks = node(textDAT, 'osc_callbacks')
callbacks.text = (ROOT/'osc_callbacks.py').read_text()
receiver = node(oscinDAT, 'market_in')
receiver.par.port = 7000
receiver.par.localaddress = '127.0.0.1'
receiver.par.callbacks = callbacks.name
receiver.par.active = True
receiver.par.maxlines = 20
observations = node(tableDAT, 'observations')
observations.clear(); observations.appendRow(['measurement', 'value']); observations.appendRow(['source', 'waiting for local UPIC preview'])
history = node(tableDAT, 'history')
history.clear(); history.appendRow(['price', 'volume'])
g = node(glslTOP, 'data_field')
g.par.pixeldat = shader.name
g.par.outputresolution = 'custom'
g.par.resolutionw = 1024
g.par.resolutionh = 576
g.seq.vec.numBlocks = 8
vectors = {
 'uControl': ["parent().fetch('frame', {}).get('running', 0)", "absTime.seconds-parent().fetch('burst', -1000)", "parent().fetch('frame', {}).get('intensity', 0)", "float(parent().fetch('frame', {}).get('word', 0) % 65521)"],
 'uMarket': ["parent().fetch('frame', {}).get('%s', 0)" % key for key in ['volume','motion','balance','pressure']],
 'uContext': ["parent().fetch('frame', {}).get('%s', 0) or 0" % key for key in ['turnover','volumeRatio','voice']] + ["absTime.seconds-parent().fetch('received', -1000)"],
 'uMeasured': ["parent().fetch('frame', {}).get('%s', 0) or 0" % key for key in ['price','marketCap','liquidity','tradeRate']],
}
for name, key, offset in [('uHistoryA','profile',0),('uHistoryB','profile',4),('uFlowA','flow',0),('uFlowB','flow',4)]:
    vectors[name] = ["parent().fetch('%s', [-1]*8)[%d]" % (key, offset+i) for i in range(4)]
for i, (name, expressions) in enumerate(vectors.items()):
    getattr(g.par, 'vec%dname' % i).val = name
    for suffix, expression in zip('xyzw', expressions):
        getattr(g.par, 'vec%dvalue%s' % (i, suffix)).expr = expression
out = node(nullTOP, 'OUT')
out.inputConnectors[0].connect(g)
out.viewer = True
info = node(infoDAT, 'shader_status'); info.par.op = g.name
readme = node(textDAT, 'READ_ME')
readme.text = 'UPIC / local market data score\nStart npm start in the UPIC folder, then visit http://127.0.0.1:4173/?touchdesigner=1 and press Listen.\nOSC /upic/frame on UDP7000. White output means no current observation.\nThe five finite Pd data voices run in the web instrument. This component renders the matching market measurements.\nPause, seek, idle and missing packets clear the output. 180ms marks; at least360ms between bursts.\nObservations contains actual values; unavailable data is labelled. No watcher estimates.\n'
for i, op_ in enumerate([receiver,callbacks,observations,history,shader,g,out,info,readme]):
    op_.nodeX = (i % 3)*240
    op_.nodeY = -(i // 3)*160
base.par.opviewer = out.name
g.cook(force=True)
base.save(str(ROOT/'UPIC-data-score.tox'))
print('UPIC built:', base.path, 'shader errors:', g.errors())

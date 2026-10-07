"""Small writer for editable Pure Data patches."""
from pathlib import Path
ROOT = Path(__file__).resolve().parent

class Patch:
    def __init__(self, title, width=1240, height=860):
        self.nodes, self.wires = [], []
        self.width, self.height = width, height
        self.text(title, 25, 15)

    def node(self, kind, value, x=None, y=None):
        if kind == 'text': value = value.replace(',', r'\,').replace(';', r'\;')
        i = len(self.nodes)
        x = 25 + (i // 17) * 330 if x is None else x
        y = 55 + (i % 17) * 40 if y is None else y
        self.nodes.append(f'#X {kind} {x} {y} {value};')
        return i

    def obj(self, value, x=None, y=None): return self.node('obj', value, x, y)
    def msg(self, value, x=None, y=None): return self.node('msg', value, x, y)
    def text(self, value, x, y): return self.node('text', value, x, y)

    def link(self, a, b, out=0, inp=0):
        self.wires.append(f'#X connect {a} {out} {b} {inp};')

    def chain(self, *nodes):
        for a, b in zip(nodes, nodes[1:]): self.link(a, b)

    def signal(self, name, ms=50):
        receive = self.obj('r ' + name)
        pack = self.obj(f'pack f {ms}')
        line = self.obj('line~')
        self.chain(receive, pack, line)
        return line

    def gain(self, audio, name, trim=1):
        mul = self.obj('*~')
        self.link(audio, mul)
        self.link(self.signal(name), mul, inp=1)
        scale = self.obj(f'*~ {trim}')
        self.chain(mul, scale)
        return scale

    def graph(self, name, values, low, high, x, y, width=350, height=100):
        self.nodes.append('\n'.join([
            '#N canvas 0 0 450 200 (subpatch) 0;',
            f'#X array {name} {len(values)} float 3;',
            '#A 0 ' + ' '.join(f'{v:.6g}' for v in values) + ';',
            f'#X coords 0 {high} {len(values)} {low} {width} {height} 1 0 0;',
            f'#X restore {x} {y} graph;']))

    def write(self, name):
        (ROOT / (name + '.pd')).write_text('\n'.join([
            f'#N canvas 50 50 {self.width} {self.height} 12;',
            *self.nodes, *self.wires]) + '\n')



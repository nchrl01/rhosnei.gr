// npm/dist/runtimeBundles.js
var runtimeBundles = [
  {
    name: "basic",
    worklet: "libpd-worklet.js",
    packages: ["vanilla"]
  },
  {
    name: "cyclone",
    worklet: "libpd-worklet-cyclone.js",
    packages: ["vanilla", "cyclone"]
  },
  {
    name: "else",
    worklet: "libpd-worklet-else.js",
    packages: ["vanilla", "else"]
  },
  {
    name: "full",
    worklet: "libpd-worklet-full.js",
    packages: ["vanilla", "cyclone", "else"]
  }
];
function normalizePackages(packages) {
  return [...new Set(packages)].sort();
}
function includesAll(bundle, requestedPackages) {
  const available = new Set(bundle.packages);
  return requestedPackages.every((packageName) => available.has(packageName));
}
function selectRuntimeBundle(options) {
  const requestedPackages = normalizePackages(options.packages);
  const bundle = runtimeBundles.filter((candidate) => includesAll(candidate, requestedPackages)).sort((a, b) => a.packages.length - b.packages.length)[0];
  if (!bundle) {
    throw new Error(`No prebuilt runtime bundle for packages: ${JSON.stringify(options.packages)}`);
  }
  return {
    name: bundle.name,
    worklet: bundle.worklet,
    packages: [...bundle.packages]
  };
}

// npm/dist/generatedManifest.js
var manifest = {
  "version": 1,
  "libraries": {
    "cyclone": {
      "objects": [
        "!-",
        "!-~",
        "!/",
        "!/~",
        "!=~",
        "%~",
        "+=~",
        "<=~",
        "<~",
        "==~",
        ">=~",
        ">~",
        "Append",
        "Borax",
        "Bucket",
        "Clip",
        "Clip~",
        "Decode",
        "Histo",
        "Line~",
        "MouseState",
        "Peak",
        "Pow~",
        "Scope~",
        "Snapshot~",
        "Table",
        "TogEdge",
        "Trough",
        "Uzi",
        "_bondo_proxy",
        "_buddy_proxy",
        "_commentsink",
        "_counter_proxy",
        "_file",
        "_funnel_proxy",
        "_gate_proxy",
        "_handle",
        "_mtrack",
        "_phasewrap1~",
        "_phasewrap2~",
        "_sprintf_proxy",
        "_substitute_proxy",
        "_switch_proxy",
        "_zlproxy",
        "accum",
        "acos",
        "acosh",
        "acosh~",
        "acos~",
        "active",
        "allpass~",
        "anal",
        "asin",
        "asinh",
        "asinh~",
        "asin~",
        "atan2~",
        "atanh",
        "atanh~",
        "atan~",
        "atodb",
        "atodb~",
        "average~",
        "avg~",
        "bangbang",
        "bitand~",
        "bitnot~",
        "bitor~",
        "bitsafe~",
        "bitshift~",
        "bitxor~",
        "bondo",
        "borax",
        "bucket",
        "buddy",
        "buffir~",
        "capture",
        "capture~",
        "cartopol",
        "cartopol~",
        "change~",
        "click~",
        "comb~",
        "comment",
        "cosh",
        "cosh~",
        "cosx~",
        "counter",
        "count~",
        "cross~",
        "curve~",
        "cycle",
        "cycle~",
        "cyclone",
        "cyclone/!-",
        "cyclone/!-~",
        "cyclone/!/",
        "cyclone/!/~",
        "cyclone/!=~",
        "cyclone/%~",
        "cyclone/+=~",
        "cyclone/<=~",
        "cyclone/<~",
        "cyclone/==~",
        "cyclone/>=~",
        "cyclone/>~",
        "cyclone/append",
        "cyclone/clip",
        "cyclone/clip~",
        "cyclone/line~",
        "cyclone/pow~",
        "cyclone/snapshot~",
        "cyclone/table",
        "dbtoa",
        "dbtoa~",
        "decide",
        "decode",
        "degrade~",
        "delay~",
        "deltaclip~",
        "delta~",
        "downsamp~",
        "drunk",
        "edge~",
        "equals~",
        "flush",
        "forward",
        "frameaccum~",
        "framedelta~",
        "fromsymbol",
        "funbuff",
        "funbuffcom",
        "funnel",
        "gate",
        "gate~",
        "greaterthaneq~",
        "greaterthan~",
        "histo",
        "index~",
        "iter",
        "join",
        "join-inlet",
        "kink~",
        "lessthaneq~",
        "lessthan~",
        "linedrive",
        "listfunnel",
        "loadmess",
        "lookup~",
        "lores~",
        "match",
        "matrix~",
        "maximum",
        "maximum~",
        "mean",
        "midiflush",
        "midiformat",
        "midiparse",
        "minimum",
        "minimum~",
        "minmax~",
        "modulo~",
        "mousefilter",
        "mousefilter_proxy",
        "mousestate",
        "mstosamps~",
        "mtr",
        "next",
        "notequals~",
        "offer",
        "onebang",
        "onebang_proxy",
        "onepole~",
        "overdrive~",
        "pak",
        "pak-inlet",
        "past",
        "peak",
        "peakamp~",
        "peek~",
        "phaseshift~",
        "phasewrap~",
        "pink~",
        "play~",
        "plusequals~",
        "poke~",
        "poltocar",
        "poltocar~",
        "pong",
        "pong~",
        "prepend",
        "prob",
        "pv",
        "rampsmooth~",
        "rand~",
        "rdiv",
        "rdiv~",
        "record~",
        "reson~",
        "rminus",
        "rminus~",
        "round",
        "round~",
        "sah~",
        "sampstoms~",
        "scale",
        "scale~",
        "scope~",
        "selector~",
        "seq",
        "sinh",
        "sinh~",
        "sinx~",
        "slide~",
        "speedlim",
        "spell",
        "spike~",
        "split",
        "spray",
        "sprintf",
        "substitute",
        "sustain",
        "svf~",
        "switch",
        "tanh",
        "tanh~",
        "tanx~",
        "teeth~",
        "thresh",
        "thresh~",
        "togedge",
        "tosymbol",
        "train~",
        "trapezoid~",
        "triangle~",
        "trough",
        "trunc~",
        "universal",
        "unjoin",
        "urn",
        "uzi",
        "vectral~",
        "wave~",
        "xbendin",
        "xbendin2",
        "xbendout",
        "xbendout2",
        "xnotein",
        "xnoteout",
        "zerox~",
        "zl",
        "zl."
      ]
    },
    "else": {
      "objects": [
        "_active_gui",
        "_elsefile",
        "_format_proxy",
        "_handle",
        "_hot_proxy",
        "_notesink",
        "_rec_track",
        "_selector_proxy",
        "above~",
        "add~",
        "adsr~",
        "allpass.2nd~",
        "allpass.rev~",
        "args",
        "asr~",
        "autofade.mc~",
        "autofade2.mc~",
        "autofade2~",
        "autofade~",
        "balance~",
        "bandpass~",
        "bandstop~",
        "bend.in",
        "bend.out",
        "bicoeff",
        "bicoeff2",
        "biquads~",
        "bitnormal~",
        "bl.imp2~",
        "bl.imp~",
        "bl.saw2~",
        "bl.saw~",
        "bl.square~",
        "bl.tri~",
        "bl.vsaw~",
        "blocksize~",
        "break",
        "brown~",
        "buffer",
        "buffer proxy",
        "button",
        "canvas.active",
        "canvas.bounds",
        "canvas.edit",
        "canvas.gop",
        "canvas.mouse",
        "canvas.name",
        "canvas.pos",
        "canvas.setname",
        "canvas.vis",
        "canvas.zoom",
        "car2pol~",
        "ceil",
        "ceil~",
        "cents2ratio",
        "cents2ratio~",
        "chance",
        "chance~",
        "changed",
        "changed proxy",
        "changed2~",
        "changed~",
        "click",
        "colors",
        "comb.filt~",
        "comb.rev~",
        "cosine~",
        "crackle~",
        "crossover~",
        "ctl.in",
        "ctl.out",
        "cusp~",
        "datetime",
        "db2lin~",
        "dbgain~",
        "decay~",
        "default",
        "default proxy",
        "del.in~",
        "del.out~",
        "delace",
        "delace~",
        "del~",
        "del~ in",
        "del~ out",
        "detect~",
        "dollsym",
        "downsample~",
        "drive~",
        "dust2~",
        "dust~",
        "else/del~",
        "envgen~",
        "eq~",
        "factor",
        "fader~",
        "fbdelay~",
        "fbsine2~",
        "fbsine~",
        "fdn.rev~",
        "ffdelay~",
        "filterdelay~",
        "float2bits",
        "floor",
        "floor~",
        "fm~",
        "fold",
        "fold~",
        "follow~",
        "fontsize",
        "format",
        "freq.shift~",
        "function",
        "function~",
        "gate2imp~",
        "gatedelay~",
        "gaussian~",
        "gbman~",
        "gcd",
        "gendyn~",
        "get~",
        "giga.rev~",
        "glide2~",
        "glide~",
        "gray~",
        "group~",
        "henon~",
        "highpass~",
        "highshelf~",
        "hot",
        "hz2rad",
        "ikeda~",
        "imp2~",
        "impseq~",
        "impulse2~",
        "impulse~",
        "imp~",
        "initmess",
        "keyboard",
        "keycode",
        "knob",
        "lace",
        "lace-inlet",
        "lace~",
        "lag2~",
        "lag~",
        "lastvalue~",
        "latoocarfian~",
        "lb",
        "lfnoise~",
        "limit",
        "lin2db~",
        "lincong~",
        "loadbanger",
        "logistic~",
        "loop",
        "lop2~",
        "lorenz~",
        "lowpass~",
        "lowshelf~",
        "match~",
        "median~",
        "merge",
        "merge-inlet",
        "merge~",
        "message",
        "message proxy",
        "messbox",
        "metronome",
        "midi",
        "mix~",
        "mouse",
        "mov.avg~",
        "mov.rms~",
        "mpe.in",
        "mtx.mc~",
        "mtx~",
        "nchs~",
        "note",
        "note.in",
        "note.out",
        "noteinfo",
        "numbox~",
        "nyquist~",
        "openfile",
        "op~",
        "order",
        "osc.route",
        "pack2",
        "pack2-inlet",
        "pad",
        "pan.mc~",
        "pan.stereo~",
        "pan2~",
        "pan4~",
        "panic",
        "pan~",
        "parabolic~",
        "peak~",
        "pgm.in",
        "pgm.out",
        "phaseseq~",
        "pic",
        "pick~",
        "pimpmul~",
        "pimp~",
        "pink~",
        "pipe2",
        "pluck~",
        "pm2~",
        "pm4~",
        "pm6~",
        "pm~",
        "pol2car~",
        "popmenu",
        "power~",
        "properties",
        "ptouch.in",
        "ptouch.out",
        "pulsecount~",
        "pulsediv~",
        "pulse~",
        "quad~",
        "quantizer",
        "quantizer~",
        "rad2hz",
        "rampnoise~",
        "ramp~",
        "rand.f",
        "rand.f~",
        "rand.hist",
        "rand.i",
        "rand.i~",
        "rand.u",
        "randpulse2~",
        "randpulse~",
        "range~",
        "ratio2cents",
        "ratio2cents~",
        "rec",
        "receiver",
        "receiver proxy",
        "repeat~",
        "rescale",
        "rescale~",
        "resonant~",
        "resonator2~",
        "resonator~",
        "rint",
        "rint~",
        "rms~",
        "rotate.mc~",
        "rotate~",
        "route2",
        "routeall",
        "router",
        "routetype",
        "s2f~",
        "saw2~",
        "saw~",
        "schmitt~",
        "scope~",
        "selector",
        "select~",
        "sender",
        "separate",
        "sequencer~",
        "shaper~",
        "sh~",
        "sig2float~",
        "sine~",
        "sin~",
        "slew2~",
        "slew~",
        "slice",
        "slice~",
        "smooth2~",
        "smooth~",
        "sort",
        "spread",
        "spread.mc~",
        "spread~",
        "square~",
        "sr~",
        "standard~",
        "status~",
        "stepnoise~",
        "sum~",
        "susloop~",
        "suspedal",
        "svfilter~",
        "symbol2any",
        "tabplayer~",
        "tabreader",
        "tabreader~",
        "tabwriter~",
        "tanh~",
        "tempo~",
        "timed.gate~",
        "toggleff~",
        "touch.in",
        "touch.out",
        "trig.delay2~",
        "trig.delay~",
        "trighold~",
        "tri~",
        "trunc",
        "trunc~",
        "unmerge",
        "unmerge~",
        "var",
        "velvet~",
        "voices",
        "vsaw~",
        "vu~",
        "wavetable~",
        "white~",
        "width~",
        "wrap2",
        "wrap2~",
        "wt2d~",
        "wt~",
        "xfade.mc~",
        "xfade~",
        "xgate.mc~",
        "xgate2.mc~",
        "xgate2~",
        "xgate~",
        "xmod2~",
        "xmod~",
        "xselect.mc~",
        "xselect2.mc~",
        "xselect2~",
        "xselect~",
        "zerocross~"
      ]
    },
    "vanilla": {
      "objects": [
        "!=",
        "%",
        "&",
        "&&",
        "*",
        "*~",
        "+",
        "+~",
        "-",
        "-~",
        "/",
        "/~",
        "<",
        "<<",
        "<=",
        "==",
        ">",
        ">=",
        ">>",
        "abs",
        "abs~",
        "adc~",
        "append",
        "array",
        "array define",
        "array get",
        "array max",
        "array min",
        "array quantile",
        "array random",
        "array set",
        "array size",
        "array sum",
        "atan",
        "atan2",
        "b",
        "backtracer",
        "bag",
        "bang",
        "bang~",
        "bendin",
        "bendout",
        "bindlist",
        "biquad~",
        "block~",
        "bng",
        "bob~",
        "bonk~",
        "bp~",
        "canvas",
        "canvasmaker",
        "catch~",
        "change",
        "choice",
        "clip",
        "clip~",
        "clone",
        "clone-inlet",
        "clone-outlet",
        "cnv",
        "cos",
        "cos~",
        "cpole~",
        "cputime",
        "ctlin",
        "ctlout",
        "czero_rev~",
        "czero~",
        "dac~",
        "dbtopow",
        "dbtopow~",
        "dbtorms",
        "dbtorms~",
        "declare",
        "del",
        "delay",
        "delread4~",
        "delread~",
        "delwrite~",
        "div",
        "drawcurve",
        "drawnumber",
        "drawpolygon",
        "drawsymbol",
        "drawtext",
        "element",
        "env~",
        "exp",
        "expr",
        "exprproxy",
        "expr~",
        "exp~",
        "f",
        "fexpr~",
        "fft~",
        "fiddle",
        "fiddle~",
        "file",
        "file define",
        "filledcurve",
        "filledpolygon",
        "float",
        "framp~",
        "fswap",
        "ftom",
        "ftom~",
        "fudiformat",
        "fudiparse",
        "gatom",
        "get",
        "getsize",
        "gfxstub",
        "guiconnect",
        "hdl",
        "hip~",
        "hradio",
        "hsl",
        "hslider",
        "i",
        "ifft~",
        "inlet",
        "inlet~",
        "int",
        "key",
        "keyname",
        "keyup",
        "libpd_receive",
        "line",
        "line~",
        "list append",
        "list fromsymbol",
        "list inlet",
        "list length",
        "list prepend",
        "list split",
        "list store",
        "list tosymbol",
        "list trim",
        "loadbang",
        "log",
        "log~",
        "loop~",
        "lop~",
        "lrshift~",
        "makefilename",
        "makenote",
        "max",
        "max~",
        "message",
        "messresponder",
        "metro",
        "midiin",
        "midiout",
        "midirealtimein",
        "min",
        "min~",
        "mod",
        "moses",
        "mtof",
        "mtof~",
        "my_canvas",
        "my_numbox",
        "namecanvas",
        "nbx",
        "netreceive",
        "netsend",
        "noise~",
        "notein",
        "noteout",
        "objectmaker",
        "openpanel",
        "oscformat",
        "oscparse",
        "osc~",
        "outlet",
        "outlet~",
        "pack",
        "page",
        "pd",
        "pdcontrol",
        "pd~",
        "pgmin",
        "pgmout",
        "phasor~",
        "pipe",
        "pique",
        "plot",
        "pointer",
        "poly",
        "polytouchin",
        "polytouchout",
        "pow",
        "powtodb",
        "powtodb~",
        "pow~",
        "print",
        "print~",
        "q8_rsqrt~",
        "q8_sqrt~",
        "qlist",
        "r",
        "radiobut",
        "radiobutton",
        "random",
        "rdb",
        "readsf~",
        "realtime",
        "receive",
        "receive~",
        "rfft~",
        "rifft~",
        "rmstodb",
        "rmstodb~",
        "route",
        "rpole~",
        "rsqrt~",
        "rzero_rev~",
        "rzero~",
        "r~",
        "s",
        "samphold~",
        "samplerate~",
        "savepanel",
        "savestate",
        "scalar",
        "scalar define",
        "sel",
        "select",
        "send",
        "send~",
        "set",
        "setsize",
        "sigmund~",
        "sig~",
        "sin",
        "slop~",
        "snake_in~",
        "snake_out~",
        "snake~",
        "snapshot~",
        "soundfiler",
        "spigot",
        "sqrt",
        "sqrt~",
        "stdout",
        "stripnote",
        "struct",
        "swap",
        "switch~",
        "symbol",
        "sysexin",
        "s~",
        "t",
        "table",
        "tabosc4~",
        "tabplay~",
        "tabread",
        "tabread4",
        "tabread4~",
        "tabread~",
        "tabreceive~",
        "tabsend~",
        "tabwrite",
        "tabwrite~",
        "tan",
        "template",
        "text",
        "text define",
        "text delete",
        "text fromlist",
        "text get",
        "text insert",
        "text search",
        "text sequence",
        "text set",
        "text size",
        "text tolist",
        "textfile",
        "tgl",
        "threshold~",
        "throw~",
        "timer",
        "toggle",
        "touchin",
        "touchout",
        "trace",
        "trigger",
        "unpack",
        "until",
        "v",
        "value",
        "vcf~",
        "vdl",
        "vd~",
        "vline~",
        "vpointer",
        "vradio",
        "vsl",
        "vslider",
        "vsnapshot~",
        "vu",
        "wrap",
        "wrap~",
        "writesf~",
        "|",
        "||"
      ]
    }
  }
};

// npm/dist/patchRuntime.js
function tokens(record) {
  return record.trim().split(/(?<!\\)\s+/).filter(Boolean);
}
function runtimeObjectName(name, packages, manifest2) {
  const slash = name.indexOf("/");
  if (slash <= 0 || slash >= name.length - 1)
    return name;
  const library = name.slice(0, slash);
  if (!packages.has(library))
    return name;
  const shortName = name.slice(slash + 1);
  const objects = manifest2.libraries[library]?.objects ?? [];
  return objects.includes(shortName) ? shortName : name;
}
function prepareRuntimeSource(source, packages, manifest2) {
  const selectedPackages = new Set(packages);
  const records = source.split(/(;\s*\n?)/);
  for (let index = 0; index < records.length; index += 2) {
    const record = records[index];
    const parts = tokens(record);
    if (parts[0] !== "#X" || parts[1] !== "obj" || parts.length < 5) {
      continue;
    }
    const nextName = runtimeObjectName(parts[4], selectedPackages, manifest2);
    if (nextName === parts[4])
      continue;
    const leading = record.match(/^\s*/)?.[0] ?? "";
    const trailing = record.match(/\s*$/)?.[0] ?? "";
    records[index] = leading + [...parts.slice(0, 4), nextName, ...parts.slice(5)].join(" ") + trailing;
  }
  return records.join("");
}
function prepareRuntimeFiles(files, packages, manifest2) {
  return Object.fromEntries(Object.entries(files).map(([path, source]) => [
    path,
    prepareRuntimeSource(source, packages, manifest2)
  ]));
}

// npm/dist/runtime.js
function validatePath(path) {
  if (path === "")
    throw new Error("Pd file path cannot be empty.");
  if (path.startsWith("/")) {
    throw new Error(`Pd file path must be relative: ${path}`);
  }
  if (path.split("/").includes("..")) {
    throw new Error(`Pd file path cannot contain '..': ${path}`);
  }
}
function normalizeFiles(files) {
  return Object.entries(files).sort(([a], [b]) => a.localeCompare(b)).map(([path, content]) => {
    validatePath(path);
    return { path, content };
  });
}
function workletMessageToPdMessage(data) {
  const receiver = typeof data.receiver === "string" ? data.receiver : "";
  if (receiver === "")
    return null;
  switch (data.type) {
    case "recv-bang":
      return { receiver, selector: "bang", values: [] };
    case "recv-float":
      return { receiver, selector: "float", values: [Number(data.value)] };
    case "recv-symbol":
      return { receiver, selector: "symbol", values: [String(data.value)] };
    case "recv-list":
      return {
        receiver,
        selector: "list",
        values: Array.isArray(data.values) ? data.values : []
      };
    case "recv-message":
      return {
        receiver,
        selector: typeof data.selector === "string" ? data.selector : "message",
        values: Array.isArray(data.values) ? data.values : []
      };
    default:
      return null;
  }
}
var PdRuntime = class {
  node;
  audioContext;
  ownsAudioContext;
  packages;
  subscribers = /* @__PURE__ */ new Map();
  printHandlers = /* @__PURE__ */ new Set();
  errorHandlers = /* @__PURE__ */ new Set();
  readyWaiter = null;
  patchWaiter = null;
  closed = false;
  constructor(options) {
    this.audioContext = options.audioContext;
    this.node = options.node;
    this.ownsAudioContext = options.ownsAudioContext;
    this.packages = [...options.packages];
    if (options.onPrint)
      this.printHandlers.add(options.onPrint);
    if (options.onError)
      this.errorHandlers.add(options.onError);
    this.node.port.onmessage = (event) => this.handleMessage(event.data);
  }
  waitUntilReady() {
    return new Promise((resolve, reject) => {
      this.readyWaiter = { resolve, reject };
    });
  }
  loadPatch(options) {
    if (this.closed)
      throw new Error("Cannot load a patch after Pd was closed.");
    validatePath(options.entry);
    const runtimeFiles = prepareRuntimeFiles(options.files, this.packages, manifest);
    const files = normalizeFiles(runtimeFiles);
    if (!files.some((file) => file.path === options.entry)) {
      throw new Error(`Entry patch "${options.entry}" was not provided.`);
    }
    return new Promise((resolve, reject) => {
      this.patchWaiter = { resolve, reject };
      this.node.port.postMessage({
        type: "load",
        files,
        openPath: options.entry
      });
    });
  }
  connect(destination = this.audioContext.destination) {
    this.node.connect(destination);
  }
  disconnect() {
    this.node.disconnect();
  }
  async close() {
    if (this.closed)
      return;
    this.closed = true;
    this.node.port.postMessage({ type: "close-patch" });
    this.node.disconnect();
    this.subscribers.clear();
    if (this.ownsAudioContext) {
      await this.audioContext.close();
    }
  }
  sendBang(name) {
    this.node.port.postMessage({ type: "bang", receiver: name });
  }
  sendFloat(name, value) {
    this.node.port.postMessage({ type: "float", receiver: name, value });
  }
  sendSymbol(name, value) {
    this.node.port.postMessage({ type: "symbol", receiver: name, value });
  }
  sendList(name, values) {
    this.node.port.postMessage({ type: "list", receiver: name, values: [...values] });
  }
  sendMessage(name, selector, values) {
    this.node.port.postMessage({
      type: "message",
      receiver: name,
      selector,
      values: [...values]
    });
  }
  subscribe(name, callback) {
    let callbacks = this.subscribers.get(name);
    if (!callbacks) {
      callbacks = /* @__PURE__ */ new Set();
      this.subscribers.set(name, callbacks);
      this.node.port.postMessage({ type: "bind", receiver: name });
    }
    callbacks.add(callback);
    return () => {
      const current = this.subscribers.get(name);
      if (!current)
        return;
      current.delete(callback);
      if (current.size === 0) {
        this.subscribers.delete(name);
        this.node.port.postMessage({ type: "unbind", receiver: name });
      }
    };
  }
  onPrint(callback) {
    this.printHandlers.add(callback);
    return () => {
      this.printHandlers.delete(callback);
    };
  }
  onError(callback) {
    this.errorHandlers.add(callback);
    return () => {
      this.errorHandlers.delete(callback);
    };
  }
  handleMessage(data) {
    if (data.type === "ready") {
      this.readyWaiter?.resolve();
      this.readyWaiter = null;
      return;
    }
    if (data.type === "patch-opened") {
      const waiter = this.patchWaiter;
      this.patchWaiter = null;
      if (data.ok) {
        waiter?.resolve();
        for (const name of this.subscribers.keys()) {
          this.node.port.postMessage({ type: "bind", receiver: name });
        }
      } else {
        waiter?.reject(new Error("Pd patch open failed."));
      }
      return;
    }
    if (data.type === "print" && typeof data.text === "string") {
      for (const handler of this.printHandlers)
        handler(data.text);
      return;
    }
    if (data.type === "error") {
      const error = new Error(typeof data.message === "string" ? data.message : "Pd error");
      this.readyWaiter?.reject(error);
      this.patchWaiter?.reject(error);
      this.readyWaiter = null;
      this.patchWaiter = null;
      for (const handler of this.errorHandlers)
        handler(error);
      return;
    }
    const message = workletMessageToPdMessage(data);
    if (!message)
      return;
    const callbacks = this.subscribers.get(message.receiver);
    if (!callbacks)
      return;
    for (const callback of callbacks)
      callback(message);
  }
};
async function createPd(options) {
  const audioContext = options.audioContext ?? new AudioContext();
  const ownsAudioContext = options.audioContext === void 0;
  const bundle = selectRuntimeBundle({ packages: options.packages });
  const workletUrl = options.workletUrl ?? bundle.worklet;
  await audioContext.audioWorklet.addModule(workletUrl);
  const node = new AudioWorkletNode(audioContext, "libpd", {
    outputChannelCount: [2]
  });
  const pd = new PdRuntime({
    audioContext,
    node,
    ownsAudioContext,
    packages: bundle.packages,
    onPrint: options.onPrint,
    onError: options.onError
  });
  await pd.waitUntilReady();
  await pd.loadPatch({ files: options.files, entry: options.entry });
  return pd;
}

// npm/dist/controls.js
function isSymbol(value) {
  return value !== void 0 && value !== "" && value !== "empty" && value !== "-";
}
function unescapePd(value) {
  return value.replace(/\\(.)/g, "$1");
}
function numberAt(values, index) {
  const value = Number.parseFloat(values[index] ?? "");
  return Number.isFinite(value) ? value : 0;
}
function savedNumber(values, legacyIndex) {
  const tail = Number.parseFloat(values[values.length - 2] ?? "");
  if (Number.isFinite(tail) && tail !== 0)
    return [tail];
  const legacy = Number.parseFloat(values[legacyIndex] ?? "");
  return Number.isFinite(legacy) ? [legacy] : [];
}
function finalNumber(values) {
  const value = Number.parseFloat(values[values.length - 1] ?? "");
  return Number.isFinite(value) ? [value] : [];
}
function numericRange(min, max, noLimitWhenZero = false) {
  if (!Number.isFinite(min) || !Number.isFinite(max))
    return [];
  if (noLimitWhenZero && min === 0 && max === 0)
    return [];
  return [min, max];
}
function addControl(controls, seen, control) {
  if (seen.has(control.name))
    return;
  seen.add(control.name);
  controls.push(control);
}
function receiverAt(args, index, synthesize) {
  const receiver = args[index];
  if (isSymbol(receiver))
    return { receiver, args, mutated: false };
  if (!synthesize || index >= args.length)
    return null;
  const next = [...args];
  const syntheticReceiver = synthesize();
  next[index] = syntheticReceiver;
  return { receiver: syntheticReceiver, args: next, mutated: true };
}
function guiAddressAt(args, receiveIndex, sendIndex, synthesize) {
  const receive = args[receiveIndex];
  if (isSymbol(receive))
    return { receiver: receive, args, mutated: false };
  const send = args[sendIndex];
  if (isSymbol(send))
    return { receiver: send, args, mutated: false };
  return receiverAt(args, receiveIndex, synthesize);
}
function controlResult(control, args, mutated = false) {
  return { control, args, mutated };
}
function controlFromObject(type, args, synthesize) {
  if (type === "hsl" || type === "vsl") {
    const receiver = guiAddressAt(args, 7, 6, synthesize);
    if (!receiver)
      return controlResult(null, args);
    return controlResult({
      name: unescapePd(receiver.receiver),
      kind: "slider",
      range: numericRange(numberAt(args, 2), numberAt(args, 3)),
      initial: savedNumber(args, 5)
    }, receiver.args, receiver.mutated);
  }
  if (type === "nbx") {
    const receiver = guiAddressAt(args, 7, 6, synthesize);
    if (!receiver)
      return controlResult(null, args);
    return controlResult({
      name: unescapePd(receiver.receiver),
      kind: "number",
      range: numericRange(numberAt(args, 2), numberAt(args, 3), true),
      initial: savedNumber(args, 5)
    }, receiver.args, receiver.mutated);
  }
  if (type === "bng") {
    const receiver = guiAddressAt(args, 5, 4, synthesize);
    if (!receiver)
      return controlResult(null, args);
    return controlResult({
      name: unescapePd(receiver.receiver),
      kind: "bang",
      range: [],
      initial: []
    }, receiver.args, receiver.mutated);
  }
  if (type === "tgl") {
    const receiver = guiAddressAt(args, 3, 2, synthesize);
    if (!receiver)
      return controlResult(null, args);
    return controlResult({
      name: unescapePd(receiver.receiver),
      kind: "toggle",
      range: [0, 1],
      initial: savedNumber(args, 1).map((value) => value ? 1 : 0)
    }, receiver.args, receiver.mutated);
  }
  if (type === "hradio" || type === "vradio") {
    const receiver = guiAddressAt(args, 5, 4, synthesize);
    if (!receiver)
      return controlResult(null, args);
    const count = numberAt(args, 3);
    return controlResult({
      name: unescapePd(receiver.receiver),
      kind: "number",
      range: count > 0 ? [0, count - 1] : [],
      initial: finalNumber(args)
    }, receiver.args, receiver.mutated);
  }
  return controlResult(null, args);
}
function controlFromAtom(type, args) {
  if (type !== "floatatom")
    return null;
  const receiver = args[7];
  if (!isSymbol(receiver))
    return null;
  return {
    name: unescapePd(receiver),
    kind: "number",
    range: numericRange(numberAt(args, 3), numberAt(args, 4), true),
    initial: []
  };
}
function tokens2(record) {
  return record.trim().split(/(?<!\\)\s+/).filter(Boolean);
}
function cleanControl(control) {
  return {
    ...control,
    initial: control.initial.filter((value) => typeof value === "string" || Number.isFinite(value))
  };
}
function collectControls(source, synthesizeUnboundGui = false) {
  const records = source.split(/(;\s*\n?)/);
  const controls = [];
  const seen = /* @__PURE__ */ new Set();
  let nextSyntheticId = 0;
  const synthesize = synthesizeUnboundGui ? () => `__pdwa_${nextSyntheticId++}` : void 0;
  for (let index = 0; index < records.length; index += 2) {
    const record = records[index];
    const parts = tokens2(record);
    let control = null;
    if (parts[0] === "#X" && parts[1] === "obj" && parts.length >= 5) {
      const result = controlFromObject(parts[4], parts.slice(5), synthesize);
      control = result.control;
      if (result.mutated) {
        const leading = record.match(/^\s*/)?.[0] ?? "";
        const trailing = record.match(/\s*$/)?.[0] ?? "";
        records[index] = leading + parts.slice(0, 5).join(" ") + " " + result.args.join(" ") + trailing;
      }
    } else if (parts[0] === "#X" && parts.length >= 2) {
      control = controlFromAtom(parts[1], parts.slice(2));
    }
    if (control)
      addControl(controls, seen, cleanControl(control));
  }
  return { source: records.join(""), controls };
}
function exposeControls(options) {
  const source = options.files[options.entry];
  if (source === void 0)
    return { files: { ...options.files }, controls: [] };
  const result = collectControls(source, true);
  return {
    files: { ...options.files, [options.entry]: result.source },
    controls: result.controls
  };
}
export {
  createPd,
  exposeControls
};

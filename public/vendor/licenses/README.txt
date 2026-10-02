AV Pure Data browser runtime: notices and corresponding source
=============================================================

These files accompany libpd-worklet-full.js, libpd-worklet.js and
libpd-wasm.js in the parent directory. They preserve notices from the
specific upstream revisions used for the distributed full runtime.
Individual component and source-file licenses continue to apply.
The full runtime is NOT covered solely by libpd's BSD license.

Pinned build source
-------------------
Repository: https://github.com/hyrfilm/libpd-wasm
Revision: 5570d36ec99820b4c6fb9662be6ead7bfbd59572
Source archive:
https://github.com/hyrfilm/libpd-wasm/archive/5570d36ec99820b4c6fb9662be6ead7bfbd59572.tar.gz
Build instructions:
https://github.com/hyrfilm/libpd-wasm/blob/5570d36ec99820b4c6fb9662be6ead7bfbd59572/README.md
Compiled-source selection:
https://github.com/hyrfilm/libpd-wasm/blob/5570d36ec99820b4c6fb9662be6ead7bfbd59572/scripts/build-wasm.sh

The upstream git tree and .gitmodules pin these dependencies:

* Pure Data
  https://github.com/pure-data/pure-data/tree/b1ff370c87b579f80130a9cafbf27cd890e90882
  Archive: https://github.com/pure-data/pure-data/archive/b1ff370c87b579f80130a9cafbf27cd890e90882.tar.gz
  License: PURE-DATA-LICENSE.txt and PURE-DATA-SOURCE-NOTICES.txt.

* Cyclone
  https://github.com/porres/pd-cyclone/tree/d2cff143021c8b1a1f3cd5c71cdb32c5576ba85a
  Archive: https://github.com/porres/pd-cyclone/archive/d2cff143021c8b1a1f3cd5c71cdb32c5576ba85a.tar.gz
  License: CYCLONE-LICENSE.txt and CYCLONE-SOURCE-NOTICES.txt.

* ELSE
  https://github.com/porres/pd-else/tree/bd3fbb5a688276dcf650de8bb6a18ec0fd6017b0
  Archive: https://github.com/porres/pd-else/archive/bd3fbb5a688276dcf650de8bb6a18ec0fd6017b0.tar.gz
  Licenses: ELSE-LICENSE.txt, ELSE-LICENSE-OVERVIEW.txt, ELSE-SOURCE-NOTICES.txt
  and the individual ELSE-BSD/MIT/WTFPL/GNU license texts.

ELSE's source carries multiple licenses. For example, the compiled
giga.rev~.c and fdn.rev~.c files explicitly specify GNU GPL version 2 or
any later version. Their complete source is also included in sources/;
GPL-2.0.txt and ELSE-GNU.txt (GPL version 3, as shipped upstream) retain
the relevant full license texts. The permissive license on another
component does not replace these component-specific notices.

ELSE-CC.txt is retained from ELSE's upstream license directory for
completeness; the full runtime does not embed its Live Electronics
Tutorial. Upstream's nested dependency trees for sfizz, aubio, ffmpeg,
libsamplerate, Link, Opus and Lua are excluded by this pinned full-runtime
build's source selection. This folder does not claim those omitted
libraries are included in the compiled runtime.

SOURCE-FILES.json records source URLs and SHA-256 hashes for 646 selected
source/header files reviewed for the accompanying notices. Comment
notices retain their original wording. A header's presence in that
inventory is not a claim that every one of its code paths is compiled.
UPSTREAM-LICENSE-SOURCES.json records the exact license document URLs.

Toolchain runtime notices
-------------------------
EMSCRIPTEN-LICENSE.txt, EMSCRIPTEN-AUTHORS.txt and MUSL-COPYRIGHT.txt
retain the runtime notices from Emscripten 5.0.6, the version selected
by the upstream locked nixpkgs development environment. This version
is established by the pinned package definition, not by guessing the
compiler version from the generated JavaScript:
https://github.com/NixOS/nixpkgs/blob/549bd84d6279f9852cae6225e372cc67fb91a4c1/pkgs/development/compilers/emscripten/default.nix
https://github.com/emscripten-core/emscripten/tree/5.0.6

AV changes and rebuilding
-------------------------
The embedded WebAssembly in the full worklet is unmodified. AV adds
validated asynchronous reads and writes for the worklet's virtual file
system, and wrapper methods for binary asset transfer. These do not
expose the user's computer filesystem.

AV-runtime-changes.patch contains the complete JavaScript changes to
upstream demo/libpd-worklet-full.js and demo/libpd-wasm.js. AV's publicly
available repository also carries the resulting source files:
https://github.com/nchrl01/rhosnei.gr

To retrieve the matching complete source, including pinned dependencies:

  git clone https://github.com/hyrfilm/libpd-wasm.git av-libpd-source
  cd av-libpd-source
  git checkout 5570d36ec99820b4c6fb9662be6ead7bfbd59572
  git submodule update --init --recursive

Use the upstream locked development environment and build script:

  nix develop --command ./build.sh

The build writes demo/libpd-worklet-full.js and demo/libpd-wasm.js.
Then apply the provided AV-runtime-changes.patch from this directory
with `git apply /path/to/AV-runtime-changes.patch` in av-libpd-source.
Alternatively the patch can be applied directly to the checked-in
upstream demo artifacts at the pinned revision, without recompilation.

Upstream's build scripts, CMake file and Nix environment/lock are copied
alongside these notices for convenient inspection; use their original
repository paths when building. The lock pins nixpkgs to
549bd84d6279f9852cae6225e372cc67fb91a4c1.
This is a source/build recipe, not a claim that a fresh local compiler
run has already been proven byte-for-byte reproducible.

Other app dependencies and Envion's source/assets have their own
notices in their corresponding vendor and patches/envion directories.

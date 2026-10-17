{
  description = "libpd → WASM development environment";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
    melange.url = "github:melange-re/melange";
  };

  outputs =
    {
      self,
      nixpkgs,
      flake-utils,
      melange,
    }:
    flake-utils.lib.eachDefaultSystem (
      system:
      let
        pkgs = import nixpkgs { inherit system; };
      in
      {
        formatter = pkgs.nixfmt-rfc-style;

        devShells.default = pkgs.mkShell {
          name = "libpd-wasm";

          packages = with pkgs; [
            # --- WASM toolchain ---
            emscripten # emcc / em++ / emcmake / emmake
            nodejs_20 # required by emscripten; also for testing output in node
            python3 # emscripten internally needs python

            # --- Native build (for iterating on the stubs without WASM round-trips) ---
            cmake
            gnumake
            clang # or gcc if you prefer: pkgs.gcc
            pkg-config

            # --- Patch loading / virtual FS tooling ---
            # emcc's --preload-file and --embed-file handle this at link time,
            # but file is useful for inspecting pd patch formats
            file

            # --- JS / AudioWorklet side ---
            esbuild # bundles the AudioWorklet processor JS
            typescript # tsc for the npm package build

            # --- Debugging / inspection ---
            wabt # wasm2wat, wat2wasm, wasm-validate, wasm-objdump
            binaryen # wasm-opt (size/speed optimisation after emcc)

            jq # inspect emcc-generated compile_commands.json
            git

            # OCaml
            ocaml
            dune_3
            ocamlPackages.ocaml-lsp
            ocamlPackages.utop
            ocamlformat
            (melange.packages.${system}.melange)
          ];

          shellHook = ''
            # Emscripten needs a writable cache dir; keep it local to the checkout.
            export EM_CACHE="$PWD/.em_cache"
            mkdir -p "$EM_CACHE"

            export PATH="$PWD/scripts:$PATH"
          '';
        };
      }
    );
}

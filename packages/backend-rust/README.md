# The database peer for the Misskey backend

This currently works as a peer server that the Misskey backend calls for database processing. It intends not to have any local state but only serves the result of the queries.

Ultimately this will be a library linked by a standalone backend, while it currently can't be a wasm-compiled library because of the network use. (Can WASI somehow support it? https://github.com/bytecodealliance/wasmtime/issues/70)

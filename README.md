# Kissmey

A side project to progressively port Misskey's backend core to Rust, ultimately to be a standalone subset of the original one. Changes are mostly in [/packages/backend-rust](/packages/backend-rust).

No new feature will be born here, see [Misskey](https://github.com/misskey-dev/misskey) for fun things.

## Plan

* Let Fastify behave as a proxy to Rust backend for certain ported API endpoints
* Add Jest/E2E tests to the original Misskey repository and sync back here to keep being compatible
	* But also write unit tests in Rust

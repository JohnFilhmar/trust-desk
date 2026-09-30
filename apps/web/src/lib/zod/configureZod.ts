import { z } from "zod";

// zod 4 compiles a fast parser for each object schema with `new Function`.
// It probes for that the first time an object schema is built, and the
// site's Content-Security-Policy refuses it. zod catches the refusal and
// falls back, but the browser still logs a CSP violation for every visitor.
// `jitless` skips the probe and the compiled path.
//
// zod reads this setting while a schema is being built, not while it
// parses. So this module must run before any schema exists, which is why
// main.tsx imports it before anything else.
z.config({ jitless: true });

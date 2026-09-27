import { register } from "node:module";

await register("./test-resolver.mjs", import.meta.url);

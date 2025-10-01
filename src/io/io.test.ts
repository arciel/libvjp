import { expect, test } from "bun:test";

import { loadSafetensors } from "./safetensor";

test("load safetensors", async () => {
    const jsonMetadataObj = await loadSafetensors("../q3n/model.safetensors");
    console.dir(jsonMetadataObj, { depth: null });
    expect(jsonMetadataObj).toBeDefined();
});
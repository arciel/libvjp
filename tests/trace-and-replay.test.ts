import { expect, test } from "bun:test";
import { tracingInterpreter, replayTrace, evalInterpreter, mul, add } from "../src";
import { Atom, type Tensor } from "../src/types";


function* userland(x: Tensor): any {
    // computes: x^2 + x + 1
    const t1 = yield mul(x, x);
    const t2 = yield add(t1, x);
    const t3 = yield add(t2, 1.0);
    return t3;
}

test("trace and replay", () => {
    const jaxpr = tracingInterpreter(userland, 1);

    for (let i = 0; i < 10; i++) {
        const testParam = Math.random() * Number.MAX_VALUE;
        const directEval = evalInterpreter(userland, testParam);
        const replayEval = evalInterpreter(
            (e) => replayTrace(jaxpr, new Atom(e)),
            testParam
        )
        expect(replayEval).toBe(directEval);
    }
});
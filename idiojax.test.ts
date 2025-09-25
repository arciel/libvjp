import { expect, test } from "bun:test"

import { add, mul, jvpRun, buildJaxpr } from "./idiojax";

function* bar(x: number): Generator<any, any, any> {
    return yield add(x, 11);
 }

// Example userland generator
function* foo(x: number): Generator<any, any, any> {
    // const t1 = yield mul(x, 35);
    // return t1;
    /// computes: x^2 + 2x + 1 @ 
    /// first derivative: 2x + 2
    const xsq = yield* bar(x);   // x^2
    const x2 = yield mul(x, 2);   // 2x
    const t1 = yield add(xsq, x2); // x^2 + 2x
    const t2 = yield add(t1, 1.0); // x^2 + 2x + 1
    return t2;
}

test("JVP Interpreter", () => {
    const last = jvpRun(foo, [2.0]);
    expect(last.tangent).toBe(35);
});

test("Staging Interpreter", () => {
    const jaxpr = buildJaxpr(foo, [2.0]);
    // expect(jaxpr.toString()).toBe("(define (v_0) v_1 = mul(v_0, 35) return v_1)");
    console.log(jaxpr);
});
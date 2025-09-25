import { expect, test } from "bun:test"

import { mul, add } from "./corojax";

function* foo(x: number): any {
    /// computes: x^2 + 2x + 1
    /// first derivative: 2x + 2
    /// second derivative: 2
    const xsq = yield mul(x, x);   // x^2
    const x2 = yield mul(x, 2);   // 2x
    const t1 = yield add(xsq, x2); // x^2 + 2x
    const t2 = yield add(t1, 1.0); // x^2 + 2x + 1
    return t2;
}

test("Eval", () => {
    expect(foo(2.0)).toBe(9);
});


import { expect, test } from "bun:test";

import { add, mul } from "../src/api";
import { evalInterpreter } from "../src/interpreters/evalInterpreter";
import { derivative, jvpInterpreter } from "../src/interpreters/jvpInterpreter";
import { replayTrace, tracingInterpreter } from "../src/interpreters/tracingInterpreter";
import { eliminateDeadCode, eliminateAliases, simplifyArith, simplifyGeneric } from "../src/interpreters/passes";

import type { Tensor, UserlandFunction } from "../src/types";
import type { NTensor, UserlandGen } from "../src/types";

function* userland(x: Tensor): UserlandGen {
    const xsq = yield mul(x, x);
    const x2 = yield mul(x, 2);
    const t1 = yield add(xsq, x2);
    const t2 = yield add(t1, 1.0);
    return t2;
}

test("Eval interpreter composes with nested JVP", () => {
    const value = evalInterpreter(
        (x0: Tensor) => {
            return jvpInterpreter(
                (x1: Tensor) => {
                    return jvpInterpreter(
                        userland,
                        [x1],
                        [1.0]
                    );
                },
                [x0],
                [1.0]
            );
        },
        2.0
    );

    expect(value).toBe(2);
});

test("Staging interpreter matches the recorded trace", () => {
    const trace = tracingInterpreter(
        (x0: Tensor) => {
            return jvpInterpreter(
                (x1: Tensor) => {
                    return jvpInterpreter(
                        userland,
                        [x1],
                        [1.0]
                    );
                },
                [x0],
                [1.0]
            );
        },
        1
    );

    expect(trace.toString()).toBe(`(define-function (VReg(x0))
\t00000: VReg(v1) = Insn(mul: Atom(VReg(x0)), Atom(VReg(x0)))
\t00001: VReg(v2) = Insn(mul: Atom(VReg(x0)), Atom(1))
\t00002: VReg(v3) = Insn(mul: Atom(VReg(x0)), Atom(1))
\t00003: VReg(v4) = Insn(add: Atom(VReg(v2)), Atom(VReg(v3)))
\t00004: VReg(v5) = Insn(mul: Atom(VReg(x0)), Atom(1))
\t00005: VReg(v6) = Insn(mul: Atom(VReg(x0)), Atom(0))
\t00006: VReg(v7) = Insn(mul: Atom(1), Atom(1))
\t00007: VReg(v8) = Insn(add: Atom(VReg(v6)), Atom(VReg(v7)))
\t00008: VReg(v9) = Insn(mul: Atom(VReg(x0)), Atom(1))
\t00009: VReg(v10) = Insn(mul: Atom(VReg(x0)), Atom(0))
\t00010: VReg(v11) = Insn(mul: Atom(1), Atom(1))
\t00011: VReg(v12) = Insn(add: Atom(VReg(v10)), Atom(VReg(v11)))
\t00012: VReg(v13) = Insn(add: Atom(VReg(v5)), Atom(VReg(v9)))
\t00013: VReg(v14) = Insn(add: Atom(VReg(v8)), Atom(VReg(v12)))
\t00014: VReg(v15) = Insn(mul: Atom(VReg(x0)), Atom(2))
\t00015: VReg(v16) = Insn(mul: Atom(VReg(x0)), Atom(0))
\t00016: VReg(v17) = Insn(mul: Atom(2), Atom(1))
\t00017: VReg(v18) = Insn(add: Atom(VReg(v16)), Atom(VReg(v17)))
\t00018: VReg(v19) = Insn(mul: Atom(VReg(x0)), Atom(0))
\t00019: VReg(v20) = Insn(mul: Atom(VReg(x0)), Atom(0))
\t00020: VReg(v21) = Insn(mul: Atom(0), Atom(1))
\t00021: VReg(v22) = Insn(add: Atom(VReg(v20)), Atom(VReg(v21)))
\t00022: VReg(v23) = Insn(mul: Atom(2), Atom(1))
\t00023: VReg(v24) = Insn(mul: Atom(2), Atom(0))
\t00024: VReg(v25) = Insn(mul: Atom(1), Atom(0))
\t00025: VReg(v26) = Insn(add: Atom(VReg(v24)), Atom(VReg(v25)))
\t00026: VReg(v27) = Insn(add: Atom(VReg(v19)), Atom(VReg(v23)))
\t00027: VReg(v28) = Insn(add: Atom(VReg(v22)), Atom(VReg(v26)))
\t00028: VReg(v29) = Insn(add: Atom(VReg(v1)), Atom(VReg(v15)))
\t00029: VReg(v30) = Insn(add: Atom(VReg(v4)), Atom(VReg(v18)))
\t00030: VReg(v31) = Insn(add: Atom(VReg(v13)), Atom(VReg(v27)))
\t00031: VReg(v32) = Insn(add: Atom(VReg(v14)), Atom(VReg(v28)))
\t00032: VReg(v33) = Insn(add: Atom(VReg(v29)), Atom(1))
\t00033: VReg(v34) = Insn(add: Atom(VReg(v30)), Atom(0))
\t00034: VReg(v35) = Insn(add: Atom(VReg(v31)), Atom(0))
\t00035: VReg(v36) = Insn(add: Atom(VReg(v32)), Atom(0))
\treturn VReg(v36)
)`);
});

test("Dead code elimination retains semantics", () => {
    const trace = tracingInterpreter(
        (x0: Tensor) => {
            return jvpInterpreter(
                (x1: Tensor) => {
                    return jvpInterpreter(
                        userland,
                        [x1],
                        [1.0]
                    );
                },
                [x0],
                [1.0]
            );
        },
        1
    );

    const optimized = eliminateDeadCode(trace);

    expect(optimized.toString()).toBe(`(define-function (VReg(x0))
\t00000: VReg(v6) = Insn(mul: Atom(VReg(x0)), Atom(0))
\t00001: VReg(v7) = Insn(mul: Atom(1), Atom(1))
\t00002: VReg(v8) = Insn(add: Atom(VReg(v6)), Atom(VReg(v7)))
\t00003: VReg(v10) = Insn(mul: Atom(VReg(x0)), Atom(0))
\t00004: VReg(v11) = Insn(mul: Atom(1), Atom(1))
\t00005: VReg(v12) = Insn(add: Atom(VReg(v10)), Atom(VReg(v11)))
\t00006: VReg(v14) = Insn(add: Atom(VReg(v8)), Atom(VReg(v12)))
\t00007: VReg(v20) = Insn(mul: Atom(VReg(x0)), Atom(0))
\t00008: VReg(v21) = Insn(mul: Atom(0), Atom(1))
\t00009: VReg(v22) = Insn(add: Atom(VReg(v20)), Atom(VReg(v21)))
\t00010: VReg(v24) = Insn(mul: Atom(2), Atom(0))
\t00011: VReg(v25) = Insn(mul: Atom(1), Atom(0))
\t00012: VReg(v26) = Insn(add: Atom(VReg(v24)), Atom(VReg(v25)))
\t00013: VReg(v28) = Insn(add: Atom(VReg(v22)), Atom(VReg(v26)))
\t00014: VReg(v32) = Insn(add: Atom(VReg(v14)), Atom(VReg(v28)))
\t00015: VReg(v36) = Insn(add: Atom(VReg(v32)), Atom(0))
\treturn VReg(v36)
)`);
});

// Eval
// test("Eval Interpreter", () => {
//     expect(foo(2.0)).toBe(9);
// });


// JVP
test("JVP Interpreter", () => {
    expect(derivative(userland, 2.0)).toBe(6);
});


test("Staging Interpreter", () => {
    const jaxpr = tracingInterpreter(userland, 1);
    expect(jaxpr !== null).toBe(true);
});


test("Eval Jaxpr", () => {
    const jaxpr = tracingInterpreter(userland, 1);
    expect(evalInterpreter(
        (x) => replayTrace(jaxpr, x),
        2.0
    )).toBe(9);
});

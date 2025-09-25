import { expect, test } from "bun:test"

import { mul, add, jvp, derivative, evalJaxpr, buildJaxpr, eliminateDeadCode, simplifyArith, eliminateAliases } from "./pyjax";


const foo = (x: number) => {
    /// computes: x^2 + 2x + 1
    /// first derivative: 2x + 2
    /// second derivative: 2
    const xsq = mul(x, x);   // x^2
    const x2 = mul(x, 2);   // 2x
    const t1 = add(xsq, x2); // x^2 + 2x
    const t2 = add(t1, 1.0); // x^2 + 2x + 1
    return t2;
}

// Eval
test("Eval Interpreter", () => {
    expect(foo(2.0)).toBe(9);
});


// JVP
test("JVP Interpreter", () => {
    expect(derivative(foo, 2.0)).toBe(6);
});

test("Staging Interpreter", () => {
    const jaxpr = buildJaxpr(foo, 1);
});

test("Eval Jaxpr", () => {
    const jaxpr = buildJaxpr(foo, 1);
    expect(evalJaxpr(jaxpr, 2.0)).toBe(9);
});

test("Eval -> JVP Roundtrip", () => {
    const jitJaxpr = (x: number) => evalJaxpr(
        buildJaxpr(foo, 1),
        x
    );
    expect(jvp(jitJaxpr, 2.0, 1.0)).toEqual([9, 6]);
})

test("Eval -> Stage -> Eval", () => {

    const fooJaxpr = buildJaxpr(foo, 1);

    const jitJaxpr = (x: number) => evalJaxpr(
        fooJaxpr,
        x
    );
    
    const fooJaxprJitJaxpr = buildJaxpr(jitJaxpr, 1);

    expect(fooJaxpr.toString()).toEqual(fooJaxprJitJaxpr.toString());
    expect(evalJaxpr(fooJaxpr, 2.0)).toEqual(evalJaxpr(fooJaxprJitJaxpr, 2.0));
})

test("Optimization Passes", () => {
    const d1 = (x: number) => jvp(foo, x, 1.0)[1];
    const d1Jaxpr = ((buildJaxpr(d1, 1)));
    const d1JaxprDead = eliminateDeadCode(d1Jaxpr);
    const d1JaxprSimplify = simplifyArith(d1JaxprDead);
    const d1EliminateAliases = eliminateAliases(d1JaxprSimplify);
    expect(evalJaxpr(d1Jaxpr, 2.0)).toEqual(d1(2.0));
    expect(evalJaxpr(d1JaxprDead, 2.0)).toEqual(d1(2.0));
    expect(evalJaxpr(d1JaxprSimplify, 2.0)).toEqual(d1(2.0));
    expect(evalJaxpr(d1EliminateAliases, 2.0)).toEqual(d1(2.0));
})





// console.log(second_derivative(foo, 2.0));

// // Jaxpr 
// console.log(buildJaxpr(foo, 1));

// // VJP
// console.log("\n=== VJP Tests ===");
// const [outputValue, gradients] = vjp(foo, 2.0);
// console.log(`VJP output: ${outputValue}`);
// console.log(`VJP gradients:`, Array.from(gradients.entries()));

// console.log(`Gradient: ${gradient(foo, 2.0)}`);


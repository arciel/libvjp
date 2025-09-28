import { Atom, Equation, Insn, Jaxpr, VReg } from "../types";
import { assert } from "../util";

type GeneratorFunction = (...args: any[]) => Generator<Insn, any, any>;

export function tracingInterpreter(f: GeneratorFunction, numArgs: number) {
    let symbolCounter = 0;
    const inputs = Array.from({ length: numArgs }, () => new VReg(`x${symbolCounter++}`));
    const trace: Equation[] = [];
    const it = f(...inputs);
    let next = it.next();

    while (!next.done) {
        const binder = new VReg(`v${symbolCounter++}`);
        const insn = next.value as Insn;
        const atoms = insn.args.map((a: any) => (a instanceof Atom ? a : new Atom(a)));
        trace.push(new Equation(binder, new Insn(insn.op, atoms)));
        next = it.next(binder);
    }

    return new Jaxpr(inputs, trace, next.value as VReg);
}

export function* replayTrace(jaxpr: Jaxpr, ...args: Atom[]): any {
    const env = new Map<VReg, Atom>();
    for (let i = 0; i < jaxpr.parameters.length; i++) {
        const param = jaxpr.parameters[i];
        assert(param != null, "param is required");
        const arg = args[i];
        assert(arg != null, "arg is required");
        env.set(param, arg);
    }
    const evalAtom = (x: Atom) => x.var_ instanceof VReg ? env.get(x.var_) : x;
    for (const eqn of jaxpr.equations) {
        const args = eqn.rhs.args.map(a => evalAtom(a)?.var_);
        const result = yield new Insn(eqn.rhs.op, args);
        env.set(eqn.lhs, new Atom(result));
    }
    return evalAtom(new Atom(jaxpr.returnVal))?.var_;
}
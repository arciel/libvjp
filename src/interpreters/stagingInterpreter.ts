import { Atom, Equation, Insn, Jaxpr, VReg } from "../types";

type GeneratorFunction = (...args: any[]) => Generator<Insn, any, any>;

export function stagingInterpreter(f: GeneratorFunction, numArgs: number) {
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

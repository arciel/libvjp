import { Insn, type UserlandFunction, type Tensor } from "../types";
import { assert } from "../util";
import { evalInterpreter } from "./evalInterpreter";

export class VReg {
    constructor(public ident: string) { }

    toString() {
        return `VReg(${this.ident})`;
    }
}

export class Atom {
    constructor(public var_: VReg | Tensor) { }

    toString() {
        return `Atom(${this.var_.toString()})`;
    }
}

export class Equation {
    constructor(public lhs: VReg, public rhs: Insn) { }

    toString() {
        return `Equation(${this.lhs.toString()} = ${this.rhs.toString()})`;
    }
}

export class Jaxpr {
    constructor(
        public parameters: VReg[],
        public equations: Equation[],
        public returnVal: VReg,
    ) { }

    toString() {
        const lines: string[] = [];
        const parameterList = this.parameters.join(", ");
        lines.push(`(define-function (${parameterList})`);
        let i = 0;
        for (const eqn of this.equations) {
            lines.push(`\t${i.toString().padStart(5, "0")}: ${eqn.lhs.toString()} = ${eqn.rhs.toString()}`);
            i++;
        }
        lines.push(`\treturn ${this.returnVal}`);
        lines.push(")");
        return lines.join("\n");
    }
}

export function tracingInterpreter(f: UserlandFunction, numArgs: number) {
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

export function* replayTrace(jaxpr: Jaxpr, ...args0: unknown[]): any {
    const args = args0.map((a: any) => (a instanceof Atom ? a : new Atom(a)));
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

export const evalTrace = (jaxpr: Jaxpr, ...args: unknown[]) => {
    return evalInterpreter(
        (x) => replayTrace(jaxpr, x),
        ...args
    );
}
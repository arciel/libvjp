import { assert, logThru } from "./util";

// Core op types and primitives
type Op = 'add' | 'mul';
type Insn = { op: Op; args: any[] };
type Handler = (insn: Insn, next?: Handler) => any;



export const add = (x: any, y: any): Insn => ({ op: 'add', args: [x, y] });
export const mul = (x: any, y: any): Insn => ({ op: 'mul', args: [x, y] });

const Eval: Handler = (insn: Insn) => {
    switch (insn.op) {
        case 'add': {
            const [x, y] = insn.args;
            assert(x!=null && y!=null, "Add requires 2 arguments");
            return x + y;
        }
        case 'mul': {
            const [x, y] = insn.args;
            assert(x!=null && y!=null, "Mul requires 2 arguments");
            return x * y;
        }
        default:
            throw new Error('Invalid operation');
    }
}



class Dual {
    constructor(public primal: number, public tangent: number) { }
}

const JVPInterpreter: Handler = (insn: Insn, next1?: Handler) => {
    assert(next1, "JVPInterpreter requires an underlying handler");
    const lift = (x: any) => (x instanceof Dual ? x : new Dual(x, 0));
    const liftedArgs = insn.args.map(lift);
    switch (insn.op) {
        case 'add': {
            const [x, y] = liftedArgs;
            assert(x!=null && y!=null, "Add requires 2 arguments");
            return new Dual(
                next1(add(x.primal, y.primal)),
                next1(add(x.tangent, y.tangent))
            )
         }; break;
        case 'mul': {
            const [x, y] = liftedArgs;
            assert(x!=null && y!=null, "Mul requires 2 arguments");
            return new Dual(
                next1(mul(x.primal, y.primal)),
                next1(add(
                    next1(mul(x.primal, y.tangent)),
                    next1(mul(y.primal, x.tangent))
                ))
            )
         }; break;
        default:
            throw new Error('Invalid operation');
    }
}


export const jvpRun = (
    fn: any,
    args: any[]
) => {
    const inputs = args.map(a => new Dual(a, 1.0));
    const it = fn(...inputs);
    let insn = it.next();
    let last;
    while (!insn.done) {
        last = JVPInterpreter(insn.value as any, Eval);
        insn = it.next(last);
    }
    return last;
}


class Equation {
    constructor(public binder: string, public insn: Insn) { }
}

class Jaxpr {
    constructor(public parameters: string[], public equations: Equation[], public returnVal: string) { }

    toString() {
        return `(define (${this.parameters.join(", ")})
            ${this.equations.map(eqn => `${eqn.binder} = ${eqn.insn.op}(${eqn.insn.args.join(", ")})`).join("\n")}
            return ${this.returnVal}
        )`;
    }
    [Symbol.for("nodejs.util.inspect.custom")]() {
        return this.toString();
    }
}


class StagingInterpreter {
    constructor(public equations: Equation[] = [], public symbolCounter: number = 0) { }

    fresh() {
        return `v_${this.symbolCounter++}`;
    }

    interpret(insn: Insn) {
        const binder = this.fresh();
        this.equations.push(new Equation(binder, insn));
        return binder;
    }

}

export const buildJaxpr = (
    fn: any,
    args: any[]
) => {
    let stagingInterpreter = new StagingInterpreter();

    const inputs = Array.from({ length: args.length }, () => stagingInterpreter.fresh());
    const it = fn(...inputs);
    let insn = it.next();
    let last;
    while (!insn.done) {
        last = stagingInterpreter.interpret(insn.value as any);
        insn = it.next(last);
    }
    return new Jaxpr(inputs, stagingInterpreter.equations, last!);
}



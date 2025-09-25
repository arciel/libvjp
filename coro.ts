import { assert } from "./util";

type Tensor = number;
class Insn { constructor(public op: string, public args: any[]) { } toString() { return `Insn(${this.op}: ${this.args.join(", ")})`; } };


function add(x: Tensor, y: Tensor) {
    return new Insn("add", [x, y]);
}

function mul(x: Tensor, y: Tensor) {
    return new Insn("mul", [x, y]);
}

function* userland(x: Tensor): Generator<any, any, any> {
    const xsq = yield mul(x, x);   // x^2
    const x2 = yield mul(x, 2);   // 2x
    const t1 = yield add(xsq, x2); // x^2 + 2x
    const t2 = yield add(t1, 1.0); // x^2 + 2x + 1
    return t2;
}


function EvalInterpreter(f: Function, ...args: any[]) {
    const it = f(...args);
    let next = it.next();
    while (!next.done) {
        const { op, args } = next.value as Insn;
        switch (op) {
            case "add": {
                next = it.next(args.reduce((a, b) => a + b, 0));
            }; break;
            case "mul": {
                next = it.next(args.reduce((a, b) => a * b, 1));
            }; break;
            default: {
                throw new Error(`Invalid operation: ${op}`);
            }
        }
    }
    return next.value;
}


class Dual {
    constructor(public interpreter: any, public primal: Tensor, public tangent: Tensor = 0.0) { }
}

function* JVPInterpreter(f: Function, ...args: Dual[]) {
    let thisInterpreter = null;
    const lift = (p: Tensor | Dual, t: Tensor) => {
        if (p instanceof Dual /* && p.interpreter == thisInterpreter */) {
            return p;
        } else if (typeof p === "number") {
            return new Dual(thisInterpreter, p, t);
        }
        throw new Error("Invalid argument:" + p);
    }

    const it = f(...args);
    let next = it.next();
    while (!next.done) {
        const { op, args } = next.value as Insn;
        const liftedArgs = args.map(a => lift(a, 0.0));
        switch (op) {
            case "add": {
                const [x, y] = liftedArgs;
                assert(x != null && y != null, "Add requires 2 arguments");
                next = it.next(new Dual(
                    thisInterpreter,
                    yield add(x.primal, y.primal),
                    yield add(x.tangent, y.tangent)
                ));
            }; break;
            case "mul": {
                const [x, y] = liftedArgs;
                assert(x != null && y != null, "Mul requires 2 arguments");
                next = it.next(new Dual(
                    thisInterpreter,
                    yield mul(x.primal, y.primal),
                    yield add(yield mul(x.primal, y.tangent), yield mul(y.primal, x.tangent)
                    )));
            }; break;
            default: {
                throw new Error(`Invalid operation: ${op}`);
            }
        }
    }
    assert(next.value != null, "Invalid operation");
    assert(next.value instanceof Dual, "Invalid operation");
    return [next.value.primal, next.value.tangent];
}



class VReg { constructor(public ident: string) { } toString() { return `VReg(${this.ident})`; } };
class Equation { constructor(public lhs: VReg, public rhs: Insn) { } toString() { return `Equation(${this.lhs.toString()} = ${this.rhs.toString()})`; } };
class Jaxpr {
    parameters: VReg[];
    equations: Equation[];
    returnVal: VReg;

    constructor(parameters: VReg[], equations: Equation[], returnVal: VReg) {
        this.parameters = parameters;
        this.equations = equations;
        this.returnVal = returnVal;
    }

    toString() {
        const lines = [];
        const parameterList = this.parameters.join(", ");
        lines.push(`(define (${parameterList})`)
        let i = 0;
        for (const eqn of this.equations) {
            lines.push(`\t${i.toString().padStart(5, "0")}: ${eqn.lhs.toString()} = ${eqn.rhs.toString()}`);
            i++;
        }
        lines.push(`\treturn ${this.returnVal}`);
        lines.push(")")
        return lines.join("\n");
    }
}
function StagingInterpreter(f: Function, numArgs: number) {
    let symbolCounter = 0;
    const inputs = Array.from({ length: numArgs }, () => new VReg(`x${symbolCounter++}`));
    let trace = [];
    const it = f(...inputs);
    let next = it.next();
    while (!next.done) {
        let binder = new VReg(`v${symbolCounter++}`);
        trace.push(new Equation(binder, next.value as Insn));
        next = it.next(binder);
    }
    return new Jaxpr(inputs, trace, next.value);
}

const main = () => {

    /* Simple trace */
    // const trace = StagingInterpreter(userland, 1);
    // for (let eqn of trace) {
    //     console.log(eqn.toString());
    // }

    /* Simple eval */
    // const result = EvalInterpreter(userland, 2.0);
    // console.log(result);

    /* Simple JVP, composed with Eval */
    // const it = EvalInterpreter(
    //     JVPInterpreter,
    //     userland,
    //     [2.0],
    //     [1.0]
    // )
    //console.log("jvp:", it);


    /* Simple JVP, composed with Staging */
    const traceJVP = StagingInterpreter(
        (x: Tensor) => JVPInterpreter(userland, new Dual(null, x, 1.0)),
        1
    )

    console.log(traceJVP.toString());
};


main();

























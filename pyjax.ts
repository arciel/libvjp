import { assert } from "./util";

enum Op {
    add,
    mul,

    //// ast nodes

    id,
};


interface Interpreter {
    interpret(op: Op, ...args: any[]): any;
};


class EvalInterpreter implements Interpreter {
    interpret(op: Op, ...args: any[]): any {
        // assert all args are Number
        switch (op) {
            case Op.add:
                return args.reduce((a, b) => a + b, 0);
            case Op.mul:
                return args.reduce((a, b) => a * b, 1);
            case Op.id:
                return args[0];
            default:
                throw new Error("Invalid operation");
        }
    }
}

const interpreters = [new EvalInterpreter()];
const pushInterpreter = (interpreter: Interpreter) => {
    interpreters.push(interpreter);
}
const popInterpreter = () => {
    interpreters.pop();
}
const getInterpreter = () => {
    const last = interpreters[interpreters.length - 1];
    if (!last) {
        throw new Error("No interpreter found");
    }
    return last;
}

class WithInterpreter {
    constructor(interpreter: Interpreter) {
        pushInterpreter(interpreter);
    }

    [Symbol.dispose]() {
        popInterpreter();
    }
}


export const add = (...args: any[]) => {
    return getInterpreter().interpret(Op.add, ...args);
}

export const mul = (...args: any[]) => {
    return getInterpreter().interpret(Op.mul, ...args);
}






class TaggedDualNumber {
    constructor(public interpreter: Interpreter, public primal: number, public tangent: number = 0.0) { }
}



class JVPInterpreter implements Interpreter {

    prevInterpreter: Interpreter;
    constructor(prevInterpreter: Interpreter) {
        this.prevInterpreter = prevInterpreter;
    }

    interpret(op: Op, ...args: any[]): any {
        const liftedArgs = args.map(a => this.lift(a));
        using _ = new WithInterpreter(this.prevInterpreter);
        switch (op) {
            case Op.add: {
                assert(liftedArgs.length == 2, "Add requires 2 arguments");
                const [x, y] = liftedArgs;
                assert(x && y);
                return new TaggedDualNumber(
                    this,
                    add(x.primal, y.primal),
                    add(x.tangent, y.tangent));
            }
            case Op.mul: {
                assert(liftedArgs.length == 2, "Mul requires 2 arguments");
                const [x, y] = liftedArgs;
                assert(x && y);
                return new TaggedDualNumber(
                    this,
                    mul(x.primal, y.primal),
                    add(mul(x.primal, y.tangent), mul(y.primal, x.tangent))
                );
            }
            default:
                throw new Error("Invalid operation");
        }
    }

    lift(x: number | TaggedDualNumber) {
        if (x instanceof TaggedDualNumber && x.interpreter == this) {
            return x;
        } else if (typeof x === "number") {
            return new TaggedDualNumber(this, x, 0.0);
        } else {
            throw new Error("Invalid argument");
        }
    }

}


export const jvp = (f: (...args: any[]) => any, primal: number, tangent: number): [number, number] => {
    const jvpInterpreter = new JVPInterpreter(getInterpreter());
    const input = new TaggedDualNumber(jvpInterpreter, primal, tangent);
    using _ = new WithInterpreter(jvpInterpreter);
    const output = f(input);
    /// Not sure why this is needed, output is already a TaggedDualNumber
    const dual_output = jvpInterpreter.lift(output);
    return [dual_output.primal, dual_output.tangent];
}

export const derivative = (f: (...args: any[]) => any, x: number) => {
    const [_, tangent] = jvp(f, x, 1.0);
    return tangent;

}

// export const second_derivative = (f: (...args: any[]) => any, x: number) => {
//     return derivative(
//         (x1) => derivative(f, x1),
//         x
//     )
// }


// class VJPTracer {
//     interpreter: VJPInterpreter;
//     var_: Var;

//     constructor(interpreter: VJPInterpreter, var_: Var) {
//         this.interpreter = interpreter;
//         this.var_ = var_;
//     }

//     toString() {
//         return this.var_;
//     }
// }



// class VJPInterpreter implements Interpreter {
//     prevInterpreter: Interpreter;
//     equations: Equation[];
//     symbolCounter: number;
//     gradients: Map<Var, number>;
//     values: Map<Var, number>;

//     constructor(prevInterpreter: Interpreter) {
//         this.prevInterpreter = prevInterpreter;
//         this.equations = [];
//         this.symbolCounter = 1000;  // Start at a high number to avoid conflicts with input variables
//         this.gradients = new Map();
//         this.values = new Map();
//     }

//     fresh() {
//         return `x${this.symbolCounter++}`;
//     }

//     interpret(op: Op, ...args: any[]): any {
//         const binder = this.fresh();
//         this.equations.push(new Equation(binder, op, args));

//         // Compute the actual value using the previous interpreter
//         const value = this.computeValue(op, args);
//         this.values.set(binder, value);

//         return new VJPTracer(this, binder);
//     }

//     private computeValue(op: Op, args: any[]): number {
//         const values = args.map(arg => this.getAtomValue(arg));
//         using _ = new WithInterpreter(this.prevInterpreter);
//         switch (op) {
//             case Op.add:
//                 return add(...values);
//             case Op.mul:
//                 return mul(...values);
//             default:
//                 throw new Error("Invalid operation");
//         }
//     }

//     private getAtomValue(atom: Atom | VJPTracer): number {
//         if (atom instanceof VJPTracer) {
//             // If it's a tracer, get its stored value
//             const value = this.values.get(atom.var_);
//             if (value === undefined) {
//                 return 0.0;  // Fallback for missing values
//             }
//             return value;
//         } else if (typeof atom === 'string') {
//             // If it's a variable, get its stored value
//             const value = this.values.get(atom);
//             if (value === undefined) {
//                 return 0.0;  // Fallback for missing values
//             }
//             return value;
//         } else {
//             return atom;
//         }
//     }

//     computeGradient(outputVar: Var, seedGradient: number = 1.0): Map<Var, number> {
//         // Initialize gradients
//         this.gradients.set(outputVar, seedGradient);

//         // Process equations in reverse order for backward pass
//         for (let i = this.equations.length - 1; i >= 0; i--) {
//             const eqn = this.equations[i];
//             const outputGrad = this.gradients.get(eqn.var_) || 0.0;

//             // Get input gradients
//             const inputGrads = this.computeInputGradients(eqn.op, eqn.args, outputGrad);

//             // Group gradients by variable to avoid double-counting
//             const varGradients = new Map<Var, number>();
//             for (let j = 0; j < eqn.args.length; j++) {
//                 const arg = eqn.args[j];
//                 let varName: string | null = null;

//                 if (typeof arg === 'string') {
//                     varName = arg;
//                 } else if (arg instanceof VJPTracer) {
//                     varName = arg.var_;
//                 }

//                 if (varName) {
//                     const current = varGradients.get(varName) || 0.0;
//                     varGradients.set(varName, current + inputGrads[j]);
//                 }
//             }

//             // Add the accumulated gradients to the main gradient map
//             for (const [varName, grad] of varGradients) {
//                 const currentGrad = this.gradients.get(varName) || 0.0;
//                 this.gradients.set(varName, currentGrad + grad);
//             }
//         }

//         return this.gradients;
//     }

//     computeInputGradients(op: Op, args: Atom[], outputGrad: number): number[] {
//         switch (op) {
//             case Op.add: {
//                 // d/dx (x + y) = 1, d/dy (x + y) = 1
//                 return [outputGrad, outputGrad];
//             }
//             case Op.mul: {
//                 // d/dx (x * y) = y, d/dy (x * y) = x
//                 assert(args.length === 2, "Mul requires 2 arguments");
//                 const x = this.getValue(args[0]);
//                 const y = this.getValue(args[1]);
//                 return [outputGrad * y, outputGrad * x];
//             }
//             default:
//                 throw new Error("Invalid operation");
//         }
//     }

//     getValue(arg: Atom | VJPTracer): number {
//         return this.getAtomValue(arg);
//     }
// }


// export const vjp = (f: (...args: any[]) => any, ...primals: number[]): [number, Map<Var, number>] => {
//     const vjpInterpreter = new VJPInterpreter(getInterpreter());
//     const inputTracers = primals.map((primal, i) => new VJPTracer(vjpInterpreter, `x${i}`));

//     // Set initial values for input variables
//     inputTracers.forEach((tracer, i) => {
//         vjpInterpreter.values.set(tracer.var_, primals[i]);
//     });

//     using _ = new WithInterpreter(vjpInterpreter);
//     const outputTracer = f(...inputTracers);

//     // Get the actual output value by computing it with the previous interpreter
//     const outputValue = vjpInterpreter.values.get(outputTracer.var_);

//     // Compute gradients
//     const gradients = vjpInterpreter.computeGradient(outputTracer.var_, 1.0);

//     return [outputValue, gradients];
// }

// // // Helper function to get a nice representation of gradients
// // const formatGradients = (gradients: Map<Var, number>): string => {
// //     const entries = Array.from(gradients.entries())
// //         .filter(([_, grad]) => Math.abs(grad) > 1e-10)  // Filter out near-zero gradients
// //         .map(([var_, grad]) => `${var_}=${grad.toFixed(4)}`);
// //     return entries.length > 0 ? entries.join(', ') : 'none';
// // }

// export const gradient = (f: (...args: any[]) => any, ...xs: number[]) => {
//     const [outputValue, gradients] = vjp(f, ...xs);
//     // Return gradients for the input variables (x0, x1, etc.)
//     return xs.map((_, i) => gradients.get(`x${i}`) || 0.0);
// }


class Var { constructor(public ident: string) { } toString() { return this.ident; } };
class Atom { constructor(public var_: Var | number) { } };

class Equation {
    var_: Var;
    op: Op;
    args: Atom[];
    constructor(var_: Var, op: Op, args: Atom[]) {
        this.var_ = var_;
        this.op = op;
        this.args = args;
    }
}

class Jaxpr {
    parameters: Var[];
    equations: Equation[];
    returnVal: Atom;

    constructor(parameters: Var[], equations: Equation[], returnVal: Atom) {
        this.parameters = parameters;
        this.equations = equations;
        this.returnVal = returnVal;
    }

    toString() {
        const lines = [];
        const parameterList = this.parameters.join(", ");
        lines.push(`(define (${parameterList})`)
        for (const eqn of this.equations) {
            const args = eqn.args.map(a => a.toString()).join(", ");
            lines.push(`\t${eqn.var_} = ${Op[eqn.op]}(${args})`);
        }
        lines.push(`\treturn ${this.returnVal}`);
        lines.push(")")
        return lines.join("\n");
    }

    [Symbol.for("nodejs.util.inspect.custom")]() {
        return this.toString();
    }
}


class StagingInterpreter implements Interpreter {
    equations: Equation[];
    symbolCounter: number;
    constructor() {
        this.equations = [];
        this.symbolCounter = 0;
    }

    fresh() {
        return new Var(`x${this.symbolCounter++}`);
    }

    interpret(op: Op, ...args: any[]): any {
        const binder = this.fresh();
        this.equations.push(new Equation(binder, op, args));
        return binder;
    }
}

export const buildJaxpr = (f: (...args: any[]) => any, numArgs: number): any => {
    let stagingInterpreter = new StagingInterpreter();
    const parameters = Array.from({ length: numArgs }, () => stagingInterpreter.fresh());
    using _ = new WithInterpreter(stagingInterpreter);
    const output = f(...parameters);
    return new Jaxpr(parameters, stagingInterpreter.equations, output);
}

export const evalJaxpr = (jaxpr: Jaxpr, ...args: any[]) => {
    const env = Object.fromEntries(jaxpr.parameters.map((param, i) => [param, args[i]]));
    const evalAtom = (x: Atom) => x instanceof Var ? env[x.ident] : x;
    for (const eqn of jaxpr.equations) {
        const args = eqn.args.map(evalAtom);
        env[eqn.var_.ident] = getInterpreter().interpret(eqn.op, ...args);
    }
    return evalAtom(jaxpr.returnVal);
}


export const eliminateDeadCode = (jaxpr: Jaxpr) => {
    // walk the jaxpr backwards, keeping only insns that contribute to the final output
    const output = jaxpr.returnVal;
    const newEquations: Equation[] = [];
    const keepVars = new Set();
    keepVars.add(output);
    for (const eqn of jaxpr.equations.toReversed()) {
        if (keepVars.has(eqn.var_)) {
            newEquations.push(eqn);
            for (const arg of eqn.args) {
                if (arg instanceof Var) {
                    keepVars.add(arg);
                }
            }
        }
    }
    return new Jaxpr(jaxpr.parameters, newEquations.toReversed(), output);
}

export const simplifyArith = (jaxpr: Jaxpr) => {
    // table of rewrite rules
    // [sourceOp, [sourceArg0, sourceArg1, ...sourceArgN], replaceOp, [replaceArg0, replaceArg1, ...replaceArgN]]

    type PatternArg = number | string | null;
    type ReplacementArg = number | string;

    const identityTable: [Op, PatternArg[], Op, ReplacementArg[]][] = [
        // 
        [Op.add, ["_0", 0], Op.id, ["0"]],
        [Op.add, [0, "_0"], Op.id, ["_0"]],
        //
        [Op.mul, ["_0", 1], Op.id, ["_0"]],
        [Op.mul, [1, "_0"], Op.id, ["_0"]],
        [Op.mul, [0, "_0"], Op.id, ["_0"]],
        [Op.mul, ["_0", 0], Op.id, ["_0"]],
    ];


    const unwrapAtom = (value: any) => value instanceof Atom ? value.var_ : value;

    const argsEqual = (a: any, b: any) => {
        const ua = unwrapAtom(a);
        const ub = unwrapAtom(b);
        if (typeof ua === "number" && typeof ub === "number") {
            return ua === ub;
        }
        return a === b;
    };

    const matchArg = (actual: any, pattern: PatternArg, captures: Map<string, any>) => {
        if (pattern === null) {
            return true;
        }

        if (typeof pattern === "number") {
            const value = unwrapAtom(actual);
            return typeof value === "number" && value === pattern;
        }

        if (typeof pattern === "string") {
            const key = pattern.startsWith("_") ? pattern.slice(1) : pattern;
            if (captures.has(key)) {
                return argsEqual(captures.get(key), actual);
            }
            captures.set(key, actual);
            return true;
        }

        return false;
    };

    const instantiateArg = (spec: ReplacementArg, captures: Map<string, any>) => {
        if (typeof spec === "number") {
            return spec;
        }

        const key = spec.startsWith("_") ? spec.slice(1) : spec;
        if (!captures.has(key)) {
            throw new Error(`Missing capture for placeholder ${spec}`);
        }
        return captures.get(key);
    };

    const newEquations: Equation[] = [];
    for (const eqn of jaxpr.equations) {
        let rewritten: Equation | null = null;
        for (const [sourceOp, sourceArgs, targetOp, targetArgs] of identityTable) {
            if (eqn.op !== sourceOp) {
                continue;
            }

            if (eqn.args.length !== sourceArgs.length) {
                continue;
            }

            const captures = new Map<string, any>();
            let matched = true;
            for (let i = 0; i < sourceArgs.length; i++) {
                if (!matchArg(eqn.args[i], sourceArgs[i] as PatternArg, captures)) {
                    matched = false;
                    break;
                }
            }

            if (!matched) {
                continue;
            }

            const replacedArgs = targetArgs.map(arg => instantiateArg(arg as ReplacementArg, captures));
            rewritten = new Equation(eqn.var_, targetOp as Op, replacedArgs as any);
            break;
        }

        newEquations.push(rewritten ?? eqn);
    }
    return new Jaxpr(jaxpr.parameters, newEquations, jaxpr.returnVal);
}


const constantFold = (jaxpr: Jaxpr) => {
    let evalInterpreter = new EvalInterpreter();
    using _ = new WithInterpreter(evalInterpreter);
    const newEquations: Equation[] = [];
    const env = new Map<Var, number>();
    for (const eqn of jaxpr.equations) {
        const areAllArgsConstants = eqn.args.every(a => a instanceof Atom && typeof a.var_ === "number");
        if (areAllArgsConstants) {
            const args = eqn.args.map(a => a.var_);
            const result = getInterpreter().interpret(eqn.op, ...args);
            env.set(eqn.var_, result);
        } else {
            newEquations.push(eqn);
        }
    }

}


















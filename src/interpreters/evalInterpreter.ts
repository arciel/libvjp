import { assert } from "../util";
import { Insn, Op } from "../types";

type GeneratorFunction = (...args: any[]) => Generator<Insn, any, any>;

export function evalInterpreter(f: GeneratorFunction, ...args: any[]) {
    const it = f(...args);
    let next = it.next();
    while (!next.done) {
        const { op, args } = next.value as Insn;
        switch (op) {
            case Op.add: {
                assert(args.length === 2, "Add requires 2 arguments");
                const result = args.reduce((a: number, b: number) => a + b, 0);
                next = it.next(result);
                break;
            }
            case Op.mul: {
                assert(args.length === 2, "Mul requires 2 arguments");
                const result = args.reduce((a: number, b: number) => a * b, 1);
                next = it.next(result);
                break;
            }
            case Op.iif: {
                assert(args.length === 3, "Iif requires 3 arguments");
                const [condition, consequent, alternative] = args;
                next = it.next(condition ? consequent : alternative);
                break;
            }
            case Op.id: {
                assert(args.length === 1, "Id requires 1 argument");
                next = it.next(args[0]);
                break;
            }
            default: {
                const exhaustiveCheck: never = op;
                throw new Error(`Invalid operation: ${exhaustiveCheck}`);
            }
        }
    }
    return next.value;
}

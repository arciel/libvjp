import { assert } from "../util";
import { add, iif, mul } from "../ops";
import { Op, Tensor } from "../types";

export class Dual {
    constructor(public interpreter: symbol, public primal: any, public tangent: Tensor = 0.0) {}
}

type GeneratorFunction = (...args: any[]) => Generator<any, any, any>;

export function* jvpInterpreter(f: GeneratorFunction, primals: any[], tangents: Tensor[]) {
    const interpreterId = Symbol();

    const lift = (p: any, t: Tensor) => {
        if (p instanceof Dual && p.interpreter === interpreterId) {
            return p;
        }
        return new Dual(interpreterId, p, t);
    };

    assert(primals.length === tangents.length, "Primals and tangents must have the same length");

    const inputs = primals.map((p, i) => lift(p, tangents[i] ?? 0.0));
    const it = f(...inputs);
    let next = it.next();

    while (!next.done) {
        const { op, args } = next.value;
        const liftedArgs = args.map((a: any) => lift(a, 0.0));
        switch (op) {
            case Op.add: {
                const [x, y] = liftedArgs;
                assert(x != null && y != null, "Add requires 2 arguments");
                next = it.next(new Dual(
                    interpreterId,
                    yield add(x.primal, y.primal),
                    yield add(x.tangent, y.tangent)
                ));
                break;
            }
            case Op.mul: {
                const [x, y] = liftedArgs;
                assert(x != null && y != null, "Mul requires 2 arguments");
                next = it.next(new Dual(
                    interpreterId,
                    yield mul(x.primal, y.primal),
                    yield add(
                        yield mul(x.primal, y.tangent),
                        yield mul(y.primal, x.tangent)
                    ),
                ));
                break;
            }
            case Op.iif: {
                const [condition, consequent, alternative] = liftedArgs;
                assert(condition != null && consequent != null && alternative != null, "Iif requires 3 arguments");
                next = it.next(new Dual(
                    interpreterId,
                    yield iif(condition.primal, consequent.primal, alternative.primal),
                    yield iif(condition.tangent, consequent.tangent, alternative.tangent),
                ));
                break;
            }
            case Op.id: {
                const [value] = liftedArgs;
                assert(value != null, "Id requires 1 argument");
                next = it.next(value);
                break;
            }
            default: {
                throw new Error(`Invalid operation: ${op}`);
            }
        }
    }

    assert(next.value != null, "Invalid operation. Got " + next.value);
    return next.value.tangent;
}

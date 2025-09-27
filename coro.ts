import {
    add,
    mul,
    iif,
    EvalInterpreter,
    JVPInterpreter,
    StagingInterpreter,
    eliminateDeadCode,
    simplifyGeneric,
} from "./src";
import type { Tensor } from "./src";

type GeneratorResult<T> = Generator<any, T, any>;

function* userland(x: Tensor): GeneratorResult<Tensor> {
    const xsq = yield mul(x, x);   // x^2
    const x2 = yield mul(x, 2);   // 2x
    const t1 = yield add(xsq, x2); // x^2 + 2x
    const t2 = yield add(t1, 1.0); // x^2 + 2x + 1
    return t2;
}

const main = () => {
    const it2 = EvalInterpreter(
        (x0: Tensor) => {
            return JVPInterpreter(
                (x1: Tensor) => {
                    return JVPInterpreter(
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
    console.log("Eval o JVP o JVP:");
    console.log(it2);
    console.log('--------------------------------');

    const traceJVP2 = StagingInterpreter(
        (x0: Tensor) => {
            return JVPInterpreter(
                (x1: Tensor) => {
                    return JVPInterpreter(
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
    console.log("Staging o JVP o JVP:");
    console.log(traceJVP2.toString());
    console.log('--------------------------------');

    console.log("DCE o Staging o JVP o JVP:");
    console.log((eliminateDeadCode(traceJVP2)).toString());
    console.log('--------------------------------');

    console.log("SG(strength=1) o DCE o JVP o JVP:");
    console.log((simplifyGeneric(eliminateDeadCode(traceJVP2))).toString());
    console.log('--------------------------------');

    console.log("SG(strength=10) o DCE o JVP o JVP:");
    console.log((simplifyGeneric(eliminateDeadCode(traceJVP2), 10)).toString());
    console.log('--------------------------------');
};

main();

import { assert } from "./util";

enum Op {
    // Point-wise
    exp,
    ln,
    relu,
    // Binary
    add,
    mul,
};

class Insn { constructor(public op: Op, public args: any[]) { } };

class Dispatcher {
    register() { }
    dispatch(insn: Insn): unknown { return null; }
}

const dispatch = new Dispatcher();


export const add = (...args: any[]) => {
    return dispatch.dispatch(new Insn(Op.add, args));
};
export const mul = (...args: any[]) => {
    return dispatch.dispatch(new Insn(Op.mul, args));
};



const Eval = (insn: Insn) => {
    switch (insn.op) {
        case Op.exp: {
            return Math.exp(insn.args[0]);
        }
        case Op.ln: {
            return Math.log(insn.args[0]);
        }
        case Op.relu: {
            return Math.max(0, insn.args[0]);
        }
        case Op.add: {
            return insn.args.reduce((a, b) => a + b, 0);
        }
        case Op.mul: {
            return insn.args.reduce((a, b) => a * b, 1);
        }
        default: {
            throw new Error(`Invalid operation: ${insn.op}`);
        }
    }
}







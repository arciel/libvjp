import { assert } from "./util";
import { Atom, Equation, Insn, Jaxpr, Op, VReg, type Tensor } from "./types";

export const eliminateDeadCode = (jaxpr: Jaxpr) => {
    const output = jaxpr.returnVal;
    const newEquations: Equation[] = [];
    const keepVars = new Set<VReg>();
    keepVars.add(output);

    for (const eqn of [...jaxpr.equations].reverse()) {
        if (keepVars.has(eqn.lhs)) {
            newEquations.push(eqn);
            for (const arg of eqn.rhs.args) {
                if (arg instanceof Atom && arg.var_ instanceof VReg) {
                    keepVars.add(arg.var_);
                }
            }
        }
    }

    return new Jaxpr(jaxpr.parameters, newEquations.reverse(), output);
};

type PatternArg = Atom | string;
type ReplacementArg = Atom | string;
type RewriteRule = [Op, PatternArg[], Op, ReplacementArg[]];


const _zero = new Atom(0);
const _one = new Atom(1);
const identityTable: RewriteRule[] = [
    // additive identiy
    [Op.add, ["_0", _zero], Op.id, ["_0"]],
    [Op.add, [_zero, "_0"], Op.id, ["_0"]],
    [Op.add, [_zero, _zero], Op.id, [_zero]],

    // multiplicative identity
    [Op.mul, ["_0", _one], Op.id, ["_0"]],
    [Op.mul, [_one, "_0"], Op.id, ["_0"]],
    [Op.mul, [_one, _one], Op.id, [_one]],

    // multiplicative zero
    [Op.mul, [_zero, "_0"], Op.id, [_zero]],
    [Op.mul, ["_0", _zero], Op.id, [_zero]],
    [Op.mul, [_zero, _zero], Op.id, [_zero]],

    // simplify iif with known predicate
    [Op.iif, [_one, "_0", "_1"], Op.id, ["_0"]],
    [Op.iif, [_zero, "_0", "_1"], Op.id, ["_1"]],
];

const checkIfInsnMatchesRule = (insn: Insn, rule: RewriteRule) => {
    const captures = new Map<string, any>();
    if (insn.op !== rule[0]) {
        return { captures, matched: false, op: null };
    }
    if (insn.args.length !== rule[1].length) {
        return { captures, matched: false, op: null };
    }
    for (let i = 0; i < rule[1].length; i++) {
        const argPattern = rule[1][i];
        assert(argPattern != null, "argPattern is required");
        if (typeof argPattern === "string") {
            // is a placeholder
            captures.set(argPattern, insn.args[i]);
            continue
        } else {
            const argActual = insn.args[i];
            if (argActual.var_ === argPattern.var_) {
                continue;
            } else {
                return { captures, matched: false, op: null };
            }
        }
    }
    const replacedArgs = rule[3].map(a => typeof a === "string" ? captures.get(a) : a);
    return { matched: true, op: rule[2], args: replacedArgs };
}

export const simplifyArith = (jaxpr: Jaxpr) => {
    const newEquations: Equation[] = [];
    for (const eqn of jaxpr.equations) {
        let didRewrite = false;
        for (const rule of identityTable) {
            const { matched, op, args } = checkIfInsnMatchesRule(eqn.rhs, rule);
            if (matched) {
                assert(op != null, "op is required. Got: " + eqn.toString());
                newEquations.push(new Equation(
                    eqn.lhs,
                    new Insn(op, args)
                ));
                didRewrite = true;
                break;
            }
        }
        if (!didRewrite) {
            newEquations.push(eqn);
        }
    }
    return new Jaxpr(jaxpr.parameters, newEquations, jaxpr.returnVal);
}

export const eliminateAliases = (jaxpr: Jaxpr) => {
    const aliases: [VReg, Atom][] = [];
    const newEquations: Equation[] = [];

    for (const eqn of jaxpr.equations) {
        if (eqn.rhs.op === Op.id) {
            assert(eqn.rhs.args.length === 1, "id requires 1 argument");
            const rhs = eqn.rhs.args[0];
            assert(rhs != null, "rhs is required. Got: " + eqn.toString());
            const lhs = eqn.lhs;
            aliases.push([lhs, rhs]);
        } else {
            const newArgs = eqn.rhs.args.map((arg: any) => {
                if (arg instanceof Atom && arg.var_ instanceof VReg) {
                    const alias = aliases.find(([lhs]) => lhs === arg.var_);
                    if (alias) {
                        return alias[1];
                    }
                }
                return arg;
            });
            newEquations.push(new Equation(eqn.lhs, new Insn(eqn.rhs.op, newArgs)));
        }
    }

    const returnAlias = aliases.find(([lhs]) => lhs.ident === jaxpr.returnVal.ident);
    if (returnAlias) {
        const aliasValue = returnAlias[1];
        assert(aliasValue.var_ instanceof VReg, "Return alias must be a VReg");
        const newReturn = aliasValue.var_ as VReg;
        return new Jaxpr(jaxpr.parameters, newEquations, newReturn);
    }

    return new Jaxpr(jaxpr.parameters, newEquations, jaxpr.returnVal);
};

export const simplifyGeneric = (jaxpr: Jaxpr, strength: number = 1) => {
    let result = jaxpr;
    for (let i = 0; i < strength; i++) {
        result = eliminateAliases(simplifyArith(result));
    }
    return result;
}
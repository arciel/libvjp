import { assert } from "./util";
import { Atom, Equation, Insn, Jaxpr, Op, VReg } from "./types";

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

type PatternArg = number | string | null;
type ReplacementArg = number | string;

type RewriteRule = [Op, PatternArg[], Op, ReplacementArg[]];

const identityTable: RewriteRule[] = [
    [Op.add, ["_0", 0], Op.id, ["_0"]],
    [Op.add, [0, "_0"], Op.id, ["_0"]],
    [Op.mul, ["_0", 1], Op.id, ["_0"]],
    [Op.mul, [1, "_0"], Op.id, ["_0"]],
    [Op.mul, [0, "_0"], Op.id, [0]],
    [Op.mul, ["_0", 0], Op.id, [0]],
    [Op.iif, [1, "_0", "_1"], Op.id, ["_0"]],
    [Op.iif, [0, "_0", "_1"], Op.id, ["_1"]],
];

const unwrapAtom = (value: any) => (value instanceof Atom ? value.var_ : value);

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

export const simplifyArith = (jaxpr: Jaxpr) => {
    const newEquations: Equation[] = [];
    for (const eqn of jaxpr.equations) {
        let rewritten: Equation | null = null;
        for (const [sourceOp, sourceArgs, targetOp, targetArgs] of identityTable) {
            if (eqn.rhs.op !== sourceOp) {
                continue;
            }

            if (eqn.rhs.args.length !== sourceArgs.length) {
                continue;
            }

            const captures = new Map<string, any>();
            let matched = true;
            for (let i = 0; i < sourceArgs.length; i++) {
                if (!matchArg(eqn.rhs.args[i], sourceArgs[i] as PatternArg, captures)) {
                    matched = false;
                    break;
                }
            }

            if (!matched) {
                continue;
            }

            const replacedArgs = targetArgs.map(arg => instantiateArg(arg as ReplacementArg, captures));
            rewritten = new Equation(eqn.lhs, new Insn(targetOp, replacedArgs as any));
            break;
        }

        newEquations.push(rewritten ?? eqn);
    }
    return new Jaxpr(jaxpr.parameters, newEquations, jaxpr.returnVal);
};

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

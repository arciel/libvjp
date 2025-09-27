export type Tensor = number;

export enum Op {
    add = "add",
    mul = "mul",
    iif = "iif",
    id = "id",
}

export class Insn {
    constructor(public op: Op, public args: any[]) {}

    toString() {
        return `Insn(${this.op}: ${this.args.map(String).join(", ")})`;
    }
}

export class VReg {
    constructor(public ident: string) {}

    toString() {
        return `VReg(${this.ident})`;
    }
}

export class Atom {
    constructor(public var_: VReg | Tensor) {}

    toString() {
        return `Atom(${this.var_.toString()})`;
    }
}

export class Equation {
    constructor(public lhs: VReg, public rhs: Insn) {}

    toString() {
        return `Equation(${this.lhs.toString()} = ${this.rhs.toString()})`;
    }
}

export class Jaxpr {
    constructor(
        public parameters: VReg[],
        public equations: Equation[],
        public returnVal: VReg,
    ) {}

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

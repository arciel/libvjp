import { Insn, Op } from "./types";

type Operand = number | unknown;

export const add = (x: Operand, y: Operand) => new Insn(Op.add, [x, y]);
export const mul = (x: Operand, y: Operand) => new Insn(Op.mul, [x, y]);
export const iif = (condition: Operand, consequent: Operand, alternative: Operand) =>
    new Insn(Op.iif, [condition, consequent, alternative]);

export const id = (value: Operand) => new Insn(Op.id, [value]);

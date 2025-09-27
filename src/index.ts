import { add, iif, id, mul } from "./ops";
import { eliminateAliases, eliminateDeadCode, simplifyArith } from "./passes";
import { Dual, jvpInterpreter as jvpInterpreterImpl } from "./interpreters/jvpInterpreter";
import { evalInterpreter as evalInterpreterImpl } from "./interpreters/evalInterpreter";
import { stagingInterpreter as stagingInterpreterImpl } from "./interpreters/stagingInterpreter";
import { Atom, Equation, Insn, Jaxpr, Op, VReg } from "./types";

export { add, iif, id, mul, Atom, Equation, Insn, Jaxpr, Op, VReg, eliminateAliases, eliminateDeadCode, simplifyArith, Dual };
export type { Tensor } from "./types";
export const evalInterpreter = evalInterpreterImpl;
export const jvpInterpreter = jvpInterpreterImpl;
export const stagingInterpreter = stagingInterpreterImpl;
export const EvalInterpreter = evalInterpreterImpl;
export const JVPInterpreter = jvpInterpreterImpl;
export const StagingInterpreter = stagingInterpreterImpl;

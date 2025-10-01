export type Tensor = number;


enum DType {
    f32 = "f32",
    f16 = "f16",
    bf16 = "bf16",
    f8 = "f8",
    mxfp4 = "mxfp4",
}
export class NTensor {
    stride: number[];
    shape: number[];
    raw: ArrayBuffer;
    dtype: DType;
    constructor(raw: ArrayBuffer, shape: number[], stride: number[], dtype: DType) {
        this.stride = stride;
        this.shape = shape;
        this.raw = raw
        this.dtype = dtype;
    }

    numElements() {
        return this.shape.reduce((acc, curr) => acc * curr, 1);
    }

    numBytes() {
        return this.raw.byteLength;
    }

    shapeString() {
        return `(${this.shape.join("×")})`;
    }

    strideString() {
        return `(${this.stride.join(", ")})`;
    }

    toString() {
        return `NTensor(dtype:${DType[this.dtype]}, shape:${this.shapeString()}, stride:${this.strideString()})`;
    }

}

export enum Op {
    add = "add",
    mul = "mul",
    iif = "iif",
    id = "id",
}

export class Insn {
    constructor(public op: Op, public args: any[]) { }

    toString() {
        return `Insn(${this.op}: ${this.args.map(String).join(", ")})`;
    }
}

/// 
type UserlandYield = Insn;
type UserlandReturn = unknown;
type UserlandNext = unknown;
export type UserlandGen = Generator<UserlandYield, UserlandReturn, UserlandNext>;
/*

*/
type UserlandArgs = (Tensor & unknown)[];
export type UserlandFunction = (...args: UserlandArgs) => UserlandGen;
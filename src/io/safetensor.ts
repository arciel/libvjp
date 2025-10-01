export const loadSafetensors = async (path: string) => {
    const fileBuff = await Bun.file(path).arrayBuffer();
    const dataView = new DataView(fileBuff);

    const headerSize = dataView.getBigUint64(0, true);
    const jsonMetadataBuff = fileBuff.slice(8, 8 + Number(headerSize));
    const jsonMetadata = new TextDecoder("utf-8").decode(jsonMetadataBuff)
    const jsonMetadataObj = JSON.parse(jsonMetadata)

    const tensorBuffer = fileBuff.slice(8 + Number(headerSize));
    return jsonMetadataObj;
}


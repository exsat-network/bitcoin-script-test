function customEncode(inputString: string): Buffer {
    const encodingMap = [
        'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p',
        'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z', '1', '2', '3', '4', '5', '.'
    ];

    let buffer = Buffer.alloc(inputString.length)
    for (let i = 0; i < inputString.length; i++) {
        const charIndex = encodingMap.indexOf(inputString[i]);
        if (charIndex === -1) {
            throw new Error(`Character ${inputString[i]} is not in the encoding map.`);
        }
        buffer.writeInt8(charIndex, i)
    }
    return buffer;
}

function customDecode(buffer: Buffer): string {
    const encodingMap = [
        'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p',
        'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z', '1', '2', '3', '4', '5', '.'
    ];

    let result = ""
    for (let i of buffer) {
        result += encodingMap[i]
    }

    return result
}

// Example usage:
const encoded = customEncode('signer.exsat');
console.log(encoded.toString('hex')); // Output Buffer
const decoded = customDecode(encoded);
console.log(decoded); // Should output 'b.exsat'

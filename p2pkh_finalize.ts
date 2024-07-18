import * as bitcoin from "bitcoinjs-lib";
import axios from "axios";
import "dotenv/config.js";

const network = bitcoin.networks.regtest;
const pubkey = Buffer.from('037bbc829d6fe8f9a28fe25ecfb832266bd27d3bdf8976371cbd3fd60a5edafbc5','hex')
// Show the conversion process from pubkey to address
const aliceAddress =
    bitcoin.payments.p2pkh({
        hash: bitcoin.crypto.hash160(pubkey),
        network,
    }).address || "mzpgLi7inwoZjRjmiUX2CUYcQTtztTMF94";


console.log(
    `alice: ${aliceAddress} matches: ${
        aliceAddress === "mzpgLi7inwoZjRjmiUX2CUYcQTtztTMF94"
    }`
);

// Set inputs and outputs for transactions
const psbt = new bitcoin.Psbt({network});

// http://regtest.exactsat.io/api/v2/utxo/all?address=my3NwUoAcJZP29JQQpaWh7KtRxZQDhQrEw
//http://mempool.regtest.exactsat.io/api/tx/565d738923453bc16cd05b0c5f951f4834f4d792fa8ed256aeb300ea39ceff8c/hex
psbt.addInput({
  hash: "7da550c63c83aead00ce93fcd012a43d78a3b1c66b8f0e235697335063484587",
  index: 0,
  nonWitnessUtxo: Buffer.from(
    "02000000000101a65f21aee0efdf9145e2175efbe3140bf9db4cb136973d51f09f8d2c8dae0d110100000000ffffffff0210270000000000001976a914d3c48f2e2c2bc73d61e1e476cc9a66c5569fe1ad88ac10e4b60000000000160014c03b30a51040e4116aad376a25bf3ce9b8e2039d02483045022100b7b46eaefcd08cab923b0b468a4544499c8953e411df33e02fa86202bf2b26d10220559eeab42c560362d98eab6e535e0faf8b2ec852409229a989dfb9aa7dc4025b012103d8dd98e6425bd393e7c94b905a2b3d4b69009a1f00c34300220a5c4053fd061700000000",
    "hex"
  ),
});

const sendAmount =9000;


// customEncode
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

const version = 1
const signAccount = 'signer.exsat'

const signAccountBuffer = customEncode(signAccount);
const data = Buffer.concat([
  Buffer.from("EXSAT", "utf8"), // fixed string 'EXSAT'
  Buffer.from([version]), // version
  signAccountBuffer, // signer account
]);
const script = bitcoin.script.compile([
    bitcoin.opcodes.OP_RETURN,
    data
]);

// Add output
psbt.addOutput({
    address: aliceAddress, // Payee Address
    value: sendAmount, // The amount sent, in satoshi
});

psbt.addOutput({
    script: script,
    value: 0
});

const psbtBase64 = psbt.toBase64()
console.log(psbtBase64)

// psbt.signInput(0,alice)
const finalizeInput = (_inputIndex: number, input: any) => {
    const payment = bitcoin.payments.p2pkh({
        output: input.script,
        pubkey: pubkey,
        signature: Buffer.from('304402200d4c8c6dac322d41cb9a6fb9591eb3bbbb32cd365de9a18a3208271e1514ca80022007d117b5540851c11cae0840ca899b3060fa9c40eb07036cf09b6b8546197a7801','hex'),
    });
    const finalScriptSig= payment.input
    return {
        finalScriptSig, // For P2WSH, this should be an empty buffer
        finalScriptWitness: undefined,
    };
};
psbt.finalizeInput(0, finalizeInput);


//02000000018cffce39ea00b3ae56d28efa92d7f434481f955f0c5bd06cc13b452389735d56000000006a473044022015994d7e308afddd93b7e67c376777a3628be74d4ff40ece433f48b58ff5b32202202c9083cf104cd1c2acb0ae796bcabb21a5dfcdee5056cbc985958ad5822129e2012103d8dd98e6425bd393e7c94b905a2b3d4b69009a1f00c34300220a5c4053fd0617ffffffff0210731d00000000001976a914c03b30a51040e4116aad376a25bf3ce9b8e2039d88ac0000000000000000146a124558534154011208060d04111f041712001300000000


// Extract the hex format of the transaction
const txHex = psbt.extractTransaction().toHex();

console.log(`Transaction Hex: ${txHex}`);

// broadcast
const url = 'http://mempool.regtest.exactsat.io/api/tx';  // Blockstream’s Testnet API
axios
    .post(url, txHex)
    .then((response) => {
        console.log("Transaction broadcasted! TXID:", response.data);
    })
    .catch((error) => {
        console.error("Failed to broadcast transaction:", error.response.data);
    });

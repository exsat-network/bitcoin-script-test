import ECPairFactory from 'ecpair';
import * as ecc from 'tiny-secp256k1';
import * as bitcoin from "bitcoinjs-lib";
import axios from "axios";
import "dotenv/config.js";
import bscript, {isCanonicalScriptSignature} from "bitcoinjs-lib/src/script";

// load environment variables
const alicePriKey = process.env.ALICE1_PRIVATE_KEY || "";


// keypairs generation
const ECPair = ECPairFactory(ecc);
const network = bitcoin.networks.regtest;

const alice = ECPair.fromWIF(alicePriKey, network);

// Show the conversion process from pubkey to address
const aliceAddress =
    bitcoin.payments.p2pkh({
        hash: bitcoin.crypto.hash160(alice.publicKey),
        network,
    }).address || "my3NwUoAcJZP29JQQpaWh7KtRxZQDhQrEw";


console.log(
    `alice: ${aliceAddress} matches: ${
        aliceAddress === "my3NwUoAcJZP29JQQpaWh7KtRxZQDhQrEw"
    }`
);

// Set inputs and outputs for transactions
const psbt = new bitcoin.Psbt({network});

// http://regtest.exactsat.io/api/v2/utxo/all?address=my3NwUoAcJZP29JQQpaWh7KtRxZQDhQrEw
//http://mempool.regtest.exactsat.io/api/tx/565d738923453bc16cd05b0c5f951f4834f4d792fa8ed256aeb300ea39ceff8c/hex
psbt.addInput({
  hash: "f749e7bfb767ceb59032face95d069afdf1dd2a12a93a315c64b44ef27a66714",
  index: 0,
  nonWitnessUtxo: Buffer.from(
    "02000000018cffce39ea00b3ae56d28efa92d7f434481f955f0c5bd06cc13b452389735d56000000006a473044022015994d7e308afddd93b7e67c376777a3628be74d4ff40ece433f48b58ff5b32202202c9083cf104cd1c2acb0ae796bcabb21a5dfcdee5056cbc985958ad5822129e2012103d8dd98e6425bd393e7c94b905a2b3d4b69009a1f00c34300220a5c4053fd0617ffffffff0210731d00000000001976a914c03b30a51040e4116aad376a25bf3ce9b8e2039d88ac0000000000000000146a124558534154011208060d04111f041712001300000000",
    "hex"
  ),
});

const sendAmount = 1920000;


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
        pubkey: alice.publicKey,
        signature: Buffer.from('3045022100e8468fb7e0b30fa3c534d935f437a7e8b5eff15bef1701e3ec7010f030c9e96802206f11a6961cd11ac1e33d72b1c964011eddb95825b3e7b2d5de4d1d17cb890d4201','hex'),
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

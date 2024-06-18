import ECPairFactory from 'ecpair';
import * as ecc from 'tiny-secp256k1';
import * as bitcoin from "bitcoinjs-lib";
import axios from "axios";
import "dotenv/config.js";

// load environment variables
const alicePriKey = process.env.ALICE_PRIVATE_KEY || "";


// keypairs generation
const ECPair = ECPairFactory(ecc);
const network = bitcoin.networks.regtest;

const alice = ECPair.fromWIF(alicePriKey, network);

// Show the conversion process from pubkey to address
const aliceAddress =
    bitcoin.payments.p2pkh({
        hash: bitcoin.crypto.hash160(alice.publicKey),
        network,
    }).address || "mt7GVM7AAhPFsovEyfyhEy97oFiynDoZbr";


console.log(
    `alice: ${aliceAddress} matches: ${
        aliceAddress === "mt7GVM7AAhPFsovEyfyhEy97oFiynDoZbr"
    }`
);

// Set inputs and outputs for transactions
const psbt = new bitcoin.Psbt({network});

// http://regtest.exactsat.io/api/v2/utxo/all?address=my3NwUoAcJZP29JQQpaWh7KtRxZQDhQrEw
//http://mempool.regtest.exactsat.io/api/tx/5ee6e01670f757560181d2ad5b5c450989f86d42364e2c83104a70645464dddb/hex
psbt.addInput({
  hash: "565d738923453bc16cd05b0c5f951f4834f4d792fa8ed256aeb300ea39ceff8c",
  index: 0,
  nonWitnessUtxo: Buffer.from(
    "0200000001e3ef6e8f26e8e6fbdd310f522a686dd8ca4f6a64e2f6265e4550b3f877d9dd98000000006b483045022100ee8e394e46a1ad7ed98503630b9389ba9767e97d8af90e6f72ceef8363ca12710220079134cf659b258d4b256e340697a563c7ca8e5a90e61dc2565a736787517e71012103d8dd98e6425bd393e7c94b905a2b3d4b69009a1f00c34300220a5c4053fd0617ffffffff02209a1d00000000001976a914c03b30a51040e4116aad376a25bf3ce9b8e2039d88ac0000000000000000106a0e4558534154010920cd247e4bc81300000000",
    "hex"
  ),
});

const sendAmount = 1930000;


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
        console.log(`charIndex=${charIndex}`)
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

// Sign transaction
psbt.signInput(0, alice);

psbt.setMaximumFeeRate(70000000);

// Complete PSBT
psbt.finalizeAllInputs();


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

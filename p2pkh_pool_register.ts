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
  hash: "9dcb04da6f564d9e92b51d83607ebd32f338668c90e347cf391002b0265603a6",
  index: 0,
  nonWitnessUtxo: Buffer.from(
    "0200000000010167fd723ed321ef948791938cb71b9a8d19ac24b0db2275280cc059a112c821240100000000ffffffff0200e1f50500000000160014442ba3c05258e06a8790399757727b1b788068b5e601164e02000000160014e990b20af86e665121e1aa38461edeba32db91bc02483045022100b633f0a52926c516181eb92aef965d98ca691118ecc12b028a00e8bd97521fa502206ae928136917118a14793337375528efb0b6537c3a44f9e8767d9b84369a51a50121038d9f1319b86a99a5c6298a382c7de937fbbeb12cdca7c1549fe3fa455565309600000000",
    "hex"
  ),
});

const sendAmount = 1990000;


// customEncode
function customEncode(inputString: string): string {
  const encodingMap: { [key: string]: string } = {
    a: "00000",
    b: "00001",
    c: "00010",
    d: "00011",
    e: "00100",
    f: "00101",
    g: "00110",
    h: "00111",
    i: "01000",
    j: "01001",
    k: "01010",
    l: "01011",
    m: "01100",
    n: "01101",
    o: "01110",
    p: "01111",
    q: "10000",
    r: "10001",
    s: "10010",
    t: "10011",
    u: "10100",
    v: "10101",
    w: "10110",
    x: "10111",
    y: "11000",
    z: "11001",
    "1": "11010",
    "2": "11011",
    "3": "11100",
    "4": "11101",
    "5": "11110",
    ".": "11111",
  };

  return inputString
    .split("")
    .map((char) => encodingMap[char])
    .join("");
}

function binaryStringToBuffer(binaryString: string): Buffer {
  const byteArray = [];
  for (let i = 0; i < binaryString.length; i += 5) {
    const byte = binaryString.substring(i, i + 5);
    byteArray.push(parseInt(byte, 2));
  }
  return Buffer.from(byteArray);
}

// Add output
psbt.addOutput({
    address: aliceAddress, // Payee Address
    value: sendAmount, // The amount sent, in satoshi
});

const version = 1
const signAccount = 'signer.exsat'

const signAccountBuffer = binaryStringToBuffer(customEncode(signAccount));
const data = Buffer.concat([
  Buffer.from("EXSAT", "utf8"), // fixed string 'EXSAT'
  Buffer.from(` ${version} `, "utf8"), // version
  signAccountBuffer, // signer account
]);
const script = bitcoin.script.compile([
    bitcoin.opcodes.OP_RETURN,
    data
]);
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

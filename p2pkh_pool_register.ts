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
  hash: "57ff897afd38574af8aa521128508732322c67ac323b5a416b8da864efef15b8",
  index: 0,
  nonWitnessUtxo: Buffer.from(
    "0200000001713b2dd61ae3e61fa5161d5995d6f98061dc1124390b1f231d08c7748493d76f000000006b483045022100dfe607674239595dc0e28787190e39eefa65887a59aa8c85210896b5e1e7480702202a59beff63a941729e89a5c6063e75e3d2974c19bed988f0938885275357e74f012103d8dd98e6425bd393e7c94b905a2b3d4b69009a1f00c34300220a5c4053fd0617ffffffff0240e81d00000000001976a914c03b30a51040e4116aad376a25bf3ce9b8e2039d88ac0000000000000000106a0e455853415401920cd247e4bc813000000000",
    "hex"
  ),
});

const sendAmount = 1950000;


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
  Buffer.from([version]), // version
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

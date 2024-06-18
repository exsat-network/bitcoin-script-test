import ECPairFactory from 'ecpair';
import * as ecc from 'tiny-secp256k1';
import * as bitcoin from "bitcoinjs-lib";
import axios from "axios";
import "dotenv/config.js";


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
    hash: "5ee6e01670f757560181d2ad5b5c450989f86d42364e2c83104a70645464dddb",
    index: 0,
    nonWitnessUtxo: Buffer.from(
        "020000000196a4f8505b05cae917b0d63cc2dc00c8852b8a9b2d00ee3fa379ab594b61f60c010000006a47304402202842d96a3b9c75ad73fa94102044c6fefa5cebc241b4a7cfc09df008942a3fce02200d78b1ae7f8d107098c35018136028f43b10ff97198adcd1224476bd5eb5c1270121024121544f121f4cbf91766ea72012e35838167aaeb9d10451930516dedfa3431fffffffff0280841e00000000001976a914c03b30a51040e4116aad376a25bf3ce9b8e2039d88acc44b5603000000001976a91488d3ccf1e8b7152227522865e215f686f4f0541b88ac00000000",
        "hex"
    ),
});

const sendAmount = 1990000;


// Add output
psbt.addOutput({
    address: aliceAddress, // Payee Address
    value: sendAmount, // The amount sent, in satoshi
});

const version = 1
const signAccount = 'signer.exsat'
const data = Buffer.concat([
    Buffer.from('EXSAT', 'utf8'), // 固定字符串 'EXSAT'
    Buffer.from(` ${version} `, 'utf8'), // 版本号
    Buffer.from(signAccount, 'utf8') // 字符串地址
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

import ECPairFactory from 'ecpair';
import * as ecc from 'tiny-secp256k1';
import * as bitcoin from "bitcoinjs-lib";
import axios from "axios";
import "dotenv/config.js";
import {witnessStackToScriptWitness} from "./utils/witness_stack_to_script_witness";


// load environment variables
const alice1PriKey = process.env.ALICE1_PRIVATE_KEY || "";
const alice2PriKey = process.env.ALICE2_PRIVATE_KEY || "";
const alice3PriKey = process.env.ALICE3_PRIVATE_KEY || "";
const bobPriKey = process.env.BOB_PRIVATE_KEY || "";

// keypairs generation
const ECPair = ECPairFactory(ecc);
const network = bitcoin.networks.regtest;

// mt7GVM7AAhPFsovEyfyhEy97oFiynDoZbr(P2PKH)
const alice1 = ECPair.fromWIF(alice1PriKey, network);
const alice2 = ECPair.fromWIF(alice2PriKey, network);
const alice3 = ECPair.fromWIF(alice3PriKey, network);

//  mkmYsvm3tU1meB8nR2z7Hwd3FyEAR2FTNU(P2PKH)
const bob = ECPair.fromWIF(bobPriKey, network);

const bobAddress =
    bitcoin.payments.p2wpkh({
        hash: bitcoin.crypto.hash160(bob.publicKey),
        network,
    }).address || "bcrt1qj4fz4ntltsjze6zhsxqy2k2xn7cj077xjmfj0n";

console.log(`bob: ${bobAddress} matches: ${bobAddress === "bcrt1qj4fz4ntltsjze6zhsxqy2k2xn7cj077xjmfj0n"}`);

// Prepare custom script
const eosAccount = "miner.enf";
const locktime = 1718374380;

const lockScript = bitcoin.script.compile([
    bitcoin.opcodes.OP_2, alice1.publicKey, alice2.publicKey, alice3.publicKey, bitcoin.opcodes.OP_3,
    bitcoin.opcodes.OP_CHECKMULTISIG
]);

const pubkeys = [alice1.publicKey, alice2.publicKey, alice3.publicKey]
for (let pubkey of pubkeys) {
    console.log(`pubkey=${pubkey.toString('hex')}`)
}

//Create P2SH address
const escrowP2WSH = bitcoin.payments.p2wsh({
    redeem: bitcoin.payments.p2ms({
        pubkeys,
        m: 2,
        network,
    }), network
});


// Set inputs and outputs for transactions
const psbt = new bitcoin.Psbt({network});

//  http://regtest.exactsat.io/api/v2/utxo/all?address=bcrt1q89fqtuntlqe5k45lznjps56xqflhgr8xawfq7galzemvlcje43vsdfkyuj
// {
//       "txid": "5ad519b62c156114218cc4ebd48d6e7e49c20a781256abe13e3a9be809322a43",
//       "vout": 0,
//       "height": 39952,
//       "value": 2000000,
//       "atomicals": [],
//       "ordinals": [],
//       "runes": [],
//       "address": "bcrt1q89fqtuntlqe5k45lznjps56xqflhgr8xawfq7galzemvlcje43vsdfkyuj",
//       "spent": false,
//       "output": "5ad519b62c156114218cc4ebd48d6e7e49c20a781256abe13e3a9be809322a43:0"
//     }
psbt.addInput({
    hash: "5ad519b62c156114218cc4ebd48d6e7e49c20a781256abe13e3a9be809322a43",
    index: 0, // UTXO output index vout
    //http://mempool.regtest.exactsat.io/api/tx/6a2346e656aa69468cee7a9d8e07f0ed47470d5e3f37a855755b89954e0cd78d/hex
    witnessUtxo: {
        script: escrowP2WSH.output!,
        value: 2000000,
    },
    witnessScript: lockScript,
});


const fee = 1000;
const utxoAmount = 2000000;
const sendAmount = 200000;


const escrowP2WSHAddress = escrowP2WSH.address || "";
//2Mv687Znv1Di4afGzbLWSCCjzADn5jC6ZzF
console.log(`multisig: ${escrowP2WSHAddress} matches: ${escrowP2WSHAddress === "2Mv687Znv1Di4afGzbLWSCCjzADn5jC6ZzF"}`);
const changeAddress = escrowP2WSHAddress
console.log(`changeAddress: ${changeAddress}`)
// Add output
psbt.addOutput({
    address: escrowP2WSHAddress, // Payee Address
    value: sendAmount, // The amount sent, in satoshi
});

// change
const changeAmount = utxoAmount - sendAmount - fee;

psbt.addOutput({
    address: changeAddress,
    value: changeAmount,
});


// Sign transaction
psbt.signInput(0, alice1);
psbt.signInput(0, alice2);
// psbt.signInput(0, alice3);

const validateSigFunction = (pubkey: Buffer, msghash: Buffer, signature: Buffer) => {
    const verified = ecc.verify(msghash, pubkey, signature);
    console.log(`verified=${verified} pubkey=${pubkey} msghash=${msghash} signature=${signature}`)
    return verified
};


if (psbt.validateSignaturesOfInput(0, validateSigFunction, alice1.publicKey) && psbt.validateSignaturesOfInput(0, validateSigFunction, alice2.publicKey)) {
    psbt.finalizeInput(0);
    const txHex = psbt.extractTransaction().toHex();
    console.log(`Transaction Hex: ${txHex}`);
} else {
    console.error("签名验证失败！");
}


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

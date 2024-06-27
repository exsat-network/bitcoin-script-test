import ECPairFactory from 'ecpair';
import * as ecc from 'tiny-secp256k1';
import * as bitcoin from "bitcoinjs-lib";
import axios from "axios";
import "dotenv/config.js";
import {witnessStackToScriptWitness} from "./utils/witness_stack_to_script_witness";

const network = bitcoin.networks.regtest;

// Prepare custom script
const eosAccount = "miner.enf";
const locktime = 1718503439000;

const pubkeys = [Buffer.from('037bbc829d6fe8f9a28fe25ecfb832266bd27d3bdf8976371cbd3fd60a5edafbc5', 'hex'),
    Buffer.from('023240d4f2b2873d488fe15a8768711a7dd0e68c503156098bb0d89b9964a0b5f0', 'hex'),
    Buffer.from('02636fb3b7dc3803148ccd13655ccfdeb9e1b45dac1510961a8cf43e07bb980d95', 'hex'),]
for (let pubkey of pubkeys) {
    console.log(`${pubkey.toString('hex')}`)
}

const lockScript = bitcoin.script.compile([
    Buffer.from(eosAccount, "utf8"),
    bitcoin.opcodes.OP_DROP,
    bitcoin.opcodes.OP_DUP,
    bitcoin.opcodes.OP_IF,
    bitcoin.opcodes.OP_DROP,
    bitcoin.opcodes.OP_2, ...pubkeys, bitcoin.opcodes.OP_3,
    bitcoin.opcodes.OP_CHECKMULTISIG,
    bitcoin.opcodes.OP_ELSE,
    bitcoin.opcodes.OP_DUP, bitcoin.opcodes.OP_HASH160, bitcoin.crypto.hash160(pubkeys[0]), bitcoin.opcodes.OP_EQUALVERIFY,
    bitcoin.script.number.encode(locktime), bitcoin.opcodes.OP_CHECKLOCKTIMEVERIFY, bitcoin.opcodes.OP_DROP,
    bitcoin.opcodes.OP_CHECKSIG,
    bitcoin.opcodes.OP_ENDIF
]);

//Create P2SH address
const escrowP2WSH = bitcoin.payments.p2wsh({
    redeem: {output: lockScript, network},
    network,
});


// Set inputs and outputs for transactions
const psbt = new bitcoin.Psbt({network});

psbt.addInput({
    hash: "110dae8d2c8d9ff0513d9736b14cdbf90b14e3fb5e17e24591dfefe0ae215fa6",
    index: 0,
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
console.log(`multisig: ${escrowP2WSHAddress} matches: ${escrowP2WSHAddress === "bcrt1qawg93rm6xxxn4znhzwt7nrpstc88lxvz4xaelpl8u49qzzs94r6sg0ugvr"}`);
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

const psbtBase64 = psbt.toBase64();
console.log(`PSBT Base64: ${psbtBase64}`);


const finalizeInput = (_inputIndex: number, input: any) => {

    const signatures = [Buffer.from('3045022100f362a0aded240e83d3e46f400a4c95f98dbf190a0f8f43027d1f8a66eb2d4d03022052feb33e0c3352b45aeda60a398248bd01e3bda4e2d54fbd756cdcf511c125ce01','hex'),
    Buffer.from('3044022004b33143aeea5bb3e6e79f4579b65dedbf63583decb4bacdcb563dd43f5d258d0220558def6a8f7bb819276db30e48659e0f842b890617789ee4d18b5967cad4a19d01','hex')]

    for (let signature of signatures) {
        console.log(`signature: ${signature.toString('hex')}`)
    }

    const redeemPayment = bitcoin.payments.p2wsh({
        redeem: {
            input: bitcoin.script.compile([
                Buffer.from(""),
                ...signatures,
                bitcoin.opcodes.OP_TRUE,
            ]),
            output: input.witnessScript,
        },
    });

    const finalScriptWitness = witnessStackToScriptWitness(
        redeemPayment.witness ?? []
    );


    return {
        finalScriptSig: Buffer.from(""), // For P2WSH, this should be an empty buffer
        finalScriptWitness,
    };
};
psbt.finalizeInput(0, finalizeInput);

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

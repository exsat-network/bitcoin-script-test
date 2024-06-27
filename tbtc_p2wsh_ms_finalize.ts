import * as bitcoin from "bitcoinjs-lib";
import "dotenv/config.js";
import * as ecc from "tiny-secp256k1";
import {witnessStackToScriptWitness} from "./utils/witness_stack_to_script_witness";
import axios from "axios";

const network = bitcoin.networks.regtest;

// Prepare custom script
const eosAccount = "miner.enf";
const locktime = 1719150628000;


const pubkeys = [Buffer.from('037bbc829d6fe8f9a28fe25ecfb832266bd27d3bdf8976371cbd3fd60a5edafbc5'), Buffer.from('023240d4f2b2873d488fe15a8768711a7dd0e68c503156098bb0d89b9964a0b5f0'), Buffer.from('02636fb3b7dc3803148ccd13655ccfdeb9e1b45dac1510961a8cf43e07bb980d95')]
for (let pubkey of pubkeys) {
    console.log(`${pubkey.toString('hex')}`)
}

const lockScript = bitcoin.script.compile([
    Buffer.from(eosAccount, "utf8"),
    bitcoin.opcodes.OP_DROP,
    bitcoin.opcodes.OP_DUP,
    bitcoin.opcodes.OP_IF,
    bitcoin.opcodes.OP_DROP,
    bitcoin.opcodes.OP_2, pubkeys[0],pubkeys[1],pubkeys[2], bitcoin.opcodes.OP_3,
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

//  http://regtest.exactsat.io/api/v2/utxo/all?address=bcrt1qrq248nu6gscrwaw8ttczpmnakypzeg5ztyhkdtvj8wcdls4uczlq09pcrd
// {
//       "txid": "0899e87194fc46e8940c9dd33f46fc895e9d7d33d94523fbadd732eae9aee2dc",
//       "vout": 0,
//       "height": 0,
//       "value": 2000000,
//       "atomicals": [],
//       "ordinals": [],
//       "runes": [],
//       "address": "bcrt1qrq248nu6gscrwaw8ttczpmnakypzeg5ztyhkdtvj8wcdls4uczlq09pcrd",
//       "spent": false,
//       "output": "da95fe607cff0d4eba4d02b433a6232124831ab57f78d9480ad41bee4ad9a5ff:0"
//     }
psbt.addInput({
    hash: "13d49a05846fabef12b9382103524718ea7d380b8b99656617b67be7d48a31dd",
    index: 0, // UTXO output index vout
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
//bcrt1quumheqtd7mskhlz46v7j5jx0jtyhqpyz6jgnnjj0uzqpvph22ans6aa80z
console.log(`multisig: ${escrowP2WSHAddress} matches: ${escrowP2WSHAddress === "bcrt1quumheqtd7mskhlz46v7j5jx0jtyhqpyz6jgnnjj0uzqpvph22ans6aa80z"}`);
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

// Serialize the PSBT to base64 format
const psbtBase64 = psbt.toBase64();
console.log(`PSBT Base64: ${psbtBase64}`);

// Convert base64 to hex
const psbtHex = Buffer.from(psbtBase64, 'base64').toString('hex');
console.log(`PSBT Hex: ${psbtHex}`);

console.log(`script: ${lockScript.toString('hex')}`)

const validateSigFunction = (pubkey: Buffer, msghash: Buffer, signature: Buffer) => {
    const verified = ecc.verify(msghash, pubkey, signature);
    return verified
};


const finalizeInput = (_inputIndex: number, input: any) => {
    const signatures =[Buffer.from('3044022047f23b36ed2995a52605e610037e80f260f6ef808e0a47cb55a49ea86f6937560220139e252cab34fe78ee818972c17dd8a2531d2394130c3cd7d199adec3f6af2dc01'),
    Buffer.from('304402203fbb5c5470737b61adec6e9cdee181a69517c896094e23329c57a991df32b86f02206fbb3e451834709c1e0e30346c5bd294c64ac99d3441b933bb8197f85390c83201'),
    ];

    for (let signature of signatures) {
        console.log(`signature=${signature.toString('hex')}`)
    }

    const redeemPayment = bitcoin.payments.p2wsh({
        redeem: {
            input: bitcoin.script.compile([
                Buffer.from(""),
                ...signatures,
                bitcoin.opcodes.OP_TRUE,
                // alice1.publicKey,
            ]),
            output: input.witnessScript,
        },
    });

    const finalScriptWitness = witnessStackToScriptWitness(
        redeemPayment.witness ?? []
    );

    console.log(`finalScriptWitness=${finalScriptWitness}`)

    // Create the finalScriptWitness

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

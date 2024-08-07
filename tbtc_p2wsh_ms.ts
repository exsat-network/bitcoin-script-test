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

// Show the conversion process from pubkey to address
// const changeAddress =
//   bitcoin.payments.p2wpkh({
//     hash: bitcoin.crypto.hash160(alice1.publicKey),
//     network,
//   }).address || "bcrt1qcqanpfgsgrjpz64dxa4zt0euaxuwyquajgkhj9";

//  mkmYsvm3tU1meB8nR2z7Hwd3FyEAR2FTNU(P2PKH)
const bob = ECPair.fromWIF(bobPriKey, network);
console.log(`privkey1=${alice1.privateKey?.toString('hex')}`)
console.log(`privkey2=${alice2.privateKey?.toString('hex')}`)

const bobAddress =
    bitcoin.payments.p2wpkh({
        hash: bitcoin.crypto.hash160(bob.publicKey),
        network,
    }).address || "bcrt1qj4fz4ntltsjze6zhsxqy2k2xn7cj077xjmfj0n";

// console.log(
//   `alice: ${changeAddress} matches: ${
//     changeAddress === "bcrt1qcqanpfgsgrjpz64dxa4zt0euaxuwyquajgkhj9"
//   }`
// );
console.log(`bob: ${bobAddress} matches: ${bobAddress === "bcrt1qj4fz4ntltsjze6zhsxqy2k2xn7cj077xjmfj0n"}`);


//<depositor> DROP
// <blindingFactor> DROP
// DUP HASH160 <walletPubKeyHash> EQUAL
// IF
//   CHECKSIG
// ELSE
//   DUP HASH160 <refundPubkeyHash> EQUALVERIFY
//   <refundLocktime> CHECKLOCKTIMEVERIFY DROP
//   CHECKSIG
// ENDIF


//<depositor> DROP
// <blindingFactor> DROP
// 2 <pubkey1> <pubkey2> <pubkey3> 3
// IF
//   CHECKMULTISIG
// ELSE
//   DUP HASH160 <refundPubkeyHash> EQUALVERIFY
//   <refundLocktime> CHECKLOCKTIMEVERIFY DROP
//   CHECKSIG
// ENDIF


// Prepare custom script
const eosAccount = "miner.enf";
const locktime = 1718503439000;

const pubkeys = [alice1.publicKey, alice2.publicKey, alice3.publicKey]
for (let pubkey of pubkeys) {
    console.log(`${pubkey.toString('hex')}`)
}

const lockScript = bitcoin.script.compile([
    Buffer.from(eosAccount, "utf8"),
    bitcoin.opcodes.OP_DROP,
    bitcoin.opcodes.OP_DUP,
    bitcoin.opcodes.OP_IF,
    bitcoin.opcodes.OP_DROP,
    bitcoin.opcodes.OP_2, alice1.publicKey, alice2.publicKey, alice3.publicKey, bitcoin.opcodes.OP_3,
    bitcoin.opcodes.OP_CHECKMULTISIG,
    bitcoin.opcodes.OP_ELSE,
    bitcoin.opcodes.OP_DUP, bitcoin.opcodes.OP_HASH160, bitcoin.crypto.hash160(bob.publicKey), bitcoin.opcodes.OP_EQUALVERIFY,
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
    hash: "da95fe607cff0d4eba4d02b433a6232124831ab57f78d9480ad41bee4ad9a5ff",
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
//bcrt1q4hv28ezafayhuak7ms9qcgx0l67guyqh5fgjmxhws07ypxpgnc3q0wt2pw
console.log(`multisig: ${escrowP2WSHAddress} matches: ${escrowP2WSHAddress === "bcrt1qrq248nu6gscrwaw8ttczpmnakypzeg5ztyhkdtvj8wcdls4uczlq09pcrd"}`);
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

// Sign transaction
psbt.signInput(0, alice1);
psbt.signInput(0, alice2);

const validateSigFunction = (pubkey: Buffer, msghash: Buffer, signature: Buffer) => {
    console.log(`pubkey=${pubkey.toString('hex')}`)
    console.log(`msghash=${msghash.toString('hex')}`)
    console.log(`signature=${signature.toString('hex')}`)
    const verified = ecc.verify(msghash, pubkey, signature);
    return verified
};


const finalizeInput = (_inputIndex: number, input: any) => {
    const signatures = input.partialSig.map((sig: { signature: any; }) => sig.signature);
    // const pubkeys = input.partialSig.map((sig: { pubkey: any; }) => sig.pubkey);
    // const signatures =[Buffer.from('3044022006deff3eb19b3bdd5483b10d25bcf82d16f4fe2b5945f02955500b02e94ac4fa02201ea1b8660f8a13299d497a4d3fff23accecf11591a45e9102a9c6c2c342a3dc401'),
    //     Buffer.from('3045022100a7bba5fd013c80d73be69e6d1f4479067fc564b658a151b8e48bee239b1e8def022062b0274016bcaf3a59b02d0f395662828d0523f8f7b787c1ecaa300105f690cd01'),
    // ];


    for (let signature of signatures) {
        console.log(`signature: ${signature.toString('hex')}`)
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


    return {
        finalScriptSig: Buffer.from(""), // For P2WSH, this should be an empty buffer
        finalScriptWitness,
    };
};
psbt.finalizeInput(0, finalizeInput);


// if (psbt.validateSignaturesOfInput(0, validateSigFunction, alice1.publicKey) && psbt.validateSignaturesOfInput(0, validateSigFunction, alice2.publicKey)) {
//     psbt.finalizeInput(0, finalizeInput);
//     const txHex = psbt.extractTransaction().toHex();
//     console.log(`Transaction Hex: ${txHex}`);
// } else {
//     console.error("签名验证失败！");
// }


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

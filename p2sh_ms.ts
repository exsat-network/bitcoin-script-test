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
const escrowP2WSH = bitcoin.payments.p2sh({
    redeem: bitcoin.payments.p2ms({
        pubkeys,
        m: 2,
        network,
    }), network
});


// Set inputs and outputs for transactions
const psbt = new bitcoin.Psbt({network});

//  http://regtest.exactsat.io/api/v2/utxo/all?address=2Mv687Znv1Di4afGzbLWSCCjzADn5jC6ZzF
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
    nonWitnessUtxo: Buffer.from(
        "0200000002432a3209e89b3a3ee1ab5612780ac2497e6e8dd4ebc48c211461152cb619d55a010000006a47304402206ae6f27ebab1dd476ef0d51617076df4ba6d8dfa94e894542d4634feb0b4819a02204b7c3f1d31997f676f680f00899533867751a9bd8b270a1450ada2bb69998aa70121024121544f121f4cbf91766ea72012e35838167aaeb9d10451930516dedfa3431fffffffffa1b0cecc339c595ce00c515ee7a12c2778bd74761c7c3fada5ea9bd6472ab7d1000000006a4730440220712df12e9271a9cc0709bce3ad6429fcb0faef3b819d8db3c1956357c52b01670220306ad4e8b4ade7474de9dd9fd1d666afc7a2bfbdbe55a4cebb98648cfcd9a4b80121024121544f121f4cbf91766ea72012e35838167aaeb9d10451930516dedfa3431fffffffff0280841e000000000017a9141f2fbade685d0d1d340f9e27a23d10e998a43c1087dad6f505000000001976a91488d3ccf1e8b7152227522865e215f686f4f0541b88ac00000000",
        "hex"
    ),
    redeemScript: lockScript
});


const fee = 1000;
const utxoAmount = 2000000;
const sendAmount = 200000;


const escrowP2WSHAddress = escrowP2WSH.address || "";
//bcrt1q89fqtuntlqe5k45lznjps56xqflhgr8xawfq7galzemvlcje43vsdfkyuj
console.log(`multisig: ${escrowP2WSHAddress} matches: ${escrowP2WSHAddress === "bcrt1q89fqtuntlqe5k45lznjps56xqflhgr8xawfq7galzemvlcje43vsdfkyuj"}`);
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

const finalizeInput = (_inputIndex: number, input: any) => {
    const redeemPayment = bitcoin.payments.p2sh({
        redeem: {
            input: bitcoin.script.compile([
                //redeem scripts
                input.partialSig[0].signature,
                bob.publicKey,
            ]),
            output: input.witnessScript,
        },
    });

    const finalScriptWitness = witnessStackToScriptWitness(
        redeemPayment.witness ?? []
    );

    return {
        finalScriptSig: Buffer.from(""),
        finalScriptWitness,
    };
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

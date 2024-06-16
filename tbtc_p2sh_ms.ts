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
const locktime = 1718374380;

const lockScript = bitcoin.script.compile([
    Buffer.from(eosAccount, "utf8"),
    bitcoin.opcodes.OP_DROP,
    bitcoin.opcodes.OP_2, alice1.publicKey, alice2.publicKey, alice3.publicKey, bitcoin.opcodes.OP_3,
    bitcoin.opcodes.OP_IF,
    bitcoin.opcodes.OP_CHECKMULTISIG,
    bitcoin.opcodes.OP_ELSE,
    bitcoin.opcodes.OP_DUP, bitcoin.opcodes.OP_HASH160, bitcoin.crypto.hash160(bob.publicKey), bitcoin.opcodes.OP_EQUALVERIFY,
    bitcoin.script.number.encode(locktime), bitcoin.opcodes.OP_CHECKLOCKTIMEVERIFY, bitcoin.opcodes.OP_DROP,
    bitcoin.opcodes.OP_CHECKSIG,
    bitcoin.opcodes.OP_ENDIF
]);

//Create P2SH address
const escrowP2WSH = bitcoin.payments.p2sh({
    redeem: {output: lockScript, network},
    network,
});


// Set inputs and outputs for transactions
const psbt = new bitcoin.Psbt({network});

//  http://regtest.exactsat.io/api/v2/utxo/all?address=2NGDdEfYw8gmETC2Sj9TeJ7k5ujowuZV49w
// {
//       "txid": "228bd82ebd9fdd99ea9cff8e48df86ee7b6558b34a95026cd4610d1a1c08a278",
//       "vout": 0,
//       "height": 39931,
//       "value": 2000000,
//       "atomicals": [],
//       "ordinals": [],
//       "runes": [],
//       "address": "2NGDdEfYw8gmETC2Sj9TeJ7k5ujowuZV49w",
//       "spent": false,
//       "output": "228bd82ebd9fdd99ea9cff8e48df86ee7b6558b34a95026cd4610d1a1c08a278:0"
//     }
psbt.addInput({
    hash: "228bd82ebd9fdd99ea9cff8e48df86ee7b6558b34a95026cd4610d1a1c08a278",
    index: 0, // UTXO output index vout
    // http://mempool.regtest.exactsat.io/api/tx/228bd82ebd9fdd99ea9cff8e48df86ee7b6558b34a95026cd4610d1a1c08a278/hex
    nonWitnessUtxo: Buffer.from(
        "020000000139c6252a58ddc2fa41249119db4796d7aa7dd76dd71fb237a26a5c2499b78ef4010000006a47304402203dca3caad2fad4a1f79378434d238af63d41b462172d52b9931272badeee242c02200840a639acba0d221e198c7b3b344956a7888ec88cea0e1ecd3c28af21fec3bb0121024121544f121f4cbf91766ea72012e35838167aaeb9d10451930516dedfa3431fffffffff0280841e000000000017a914fbfd77af723d391f8da88dff0ddd38f88249968987ea895b00000000001976a91488d3ccf1e8b7152227522865e215f686f4f0541b88ac00000000",
        "hex"
    ),
    redeemScript: lockScript
});


const fee = 1000;
const utxoAmount = 2000000;
const sendAmount = 200000;


const escrowP2WSHAddress = escrowP2WSH.address || "";
//2NGDdEfYw8gmETC2Sj9TeJ7k5ujowuZV49w
console.log(`multisig: ${escrowP2WSHAddress} matches: ${escrowP2WSHAddress === "2NGDdEfYw8gmETC2Sj9TeJ7k5ujowuZV49w"}`);
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
psbt.signInput(0, alice3);

const validateSigFunction = (pubkey: Buffer, msghash: Buffer, signature: Buffer) => {
    const verified = ecc.verify(msghash, pubkey, signature);
    console.log(`verified=${verified} pubkey=${pubkey} msghash=${msghash} signature=${signature}`)
    return verified
};




const finalizeInput = (_inputIndex: number, input: any) => {
    const redeemPayment = bitcoin.payments.p2wsh({
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

if (psbt.validateSignaturesOfInput(0, validateSigFunction, alice1.publicKey) && psbt.validateSignaturesOfInput(0, validateSigFunction, alice2.publicKey) && psbt.validateSignaturesOfInput(0, validateSigFunction, alice3.publicKey)) {
    psbt.finalizeInput(0, finalizeInput);
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

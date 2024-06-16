import ECPairFactory from 'ecpair';
import * as ecc from 'tiny-secp256k1';
import * as bitcoin from "bitcoinjs-lib";
import axios from "axios";
import "dotenv/config.js";
import { witnessStackToScriptWitness } from "./utils/witness_stack_to_script_witness";


// load environment variables
const alicePriKey = process.env.ALICE1_PRIVATE_KEY || "";
const bobPriKey = process.env.BOB_PRIVATE_KEY || "";


// keypairs generation
const ECPair = ECPairFactory(ecc);
const network = bitcoin.networks.regtest;

// mt7GVM7AAhPFsovEyfyhEy97oFiynDoZbr(P2PKH)
const alice = ECPair.fromWIF(alicePriKey, network);
const aliceAddress =
  bitcoin.payments.p2pkh({
    hash: bitcoin.crypto.hash160(alice.publicKey),
    network,
  }).address || "mt7GVM7AAhPFsovEyfyhEy97oFiynDoZbr";

//  mkmYsvm3tU1meB8nR2z7Hwd3FyEAR2FTNU(P2PKH)
const bob = ECPair.fromWIF(
  bobPriKey,
  network
);

console.log(`Alice: ${aliceAddress}`)

// Prepare custom script
const eosAccount = "miner.enf";

const lockScript = bitcoin.script.compile([
  Buffer.from(eosAccount, "utf8"),
  bitcoin.opcodes.OP_DROP,
  bitcoin.opcodes.OP_DUP,
  bitcoin.opcodes.OP_HASH160,
  bitcoin.crypto.hash160(bob.publicKey),
  bitcoin.opcodes.OP_EQUALVERIFY,
  bitcoin.opcodes.OP_CHECKSIG,
]);



//Create P2SH address
const escrowP2WSH = bitcoin.payments.p2wsh({
  redeem: { output: lockScript, network },
  network,
});



// Show the conversion process from pubkey to address
const changeAddress =
  escrowP2WSH.address!;

console.log(
  `changeAddress: ${changeAddress} matches: ${
    changeAddress ===
    "bcrt1qe36qxhv39xc573x2zndgzm4ladfr20mrx6j99rv646q3zrygz6gswkg9x3"
  }
  `
);


// Set inputs and outputs for transactions
const psbt = new bitcoin.Psbt({network});

// Add input (you need to provide actual txid and output index)
  // The hash of the previous transaction is currently manually obtained through the following methods: txid as hash and vout as index. You can use axios to automatically obtain and piece together utxo.
  //
  //  https://blockstream.info/testnet/api/address/tb1q69ajlcza24nqf0atqu635r8jfyg0slm0j6e3r6s08wn6nys9pyjsgvlqju/utxo
  // [
  //   {
//       "txid": "b372db861597086ebe2c8555d4299e71d21e3fc867fb4cb34b84ff341a05d50b",
//       "vout": 0,
//       "height": 0,
//       "value": 2000000,
//       "atomicals": [],
//       "ordinals": [],
//       "runes": [],
//       "address": "bcrt1qe36qxhv39xc573x2zndgzm4ladfr20mrx6j99rv646q3zrygz6gswkg9x3",
//       "spent": false,
//       "output": "b372db861597086ebe2c8555d4299e71d21e3fc867fb4cb34b84ff341a05d50b:0"
//     }
  // ];

  psbt.addInput({
    hash: "b372db861597086ebe2c8555d4299e71d21e3fc867fb4cb34b84ff341a05d50b",
    index: 0, // UTXO output index vout
    witnessUtxo: {
      script: escrowP2WSH.output!,
      value: 2000000,
    },
    witnessScript: lockScript,
  });

const fee = 1000;
const sendAmount = 1000;
const utxoAmount = 2000000;


// Add output
psbt.addOutput({
  address: aliceAddress, // Payee Address
  value: sendAmount, // The amount sent, in satoshi
});

// change
const changeAmount = utxoAmount - sendAmount - fee;

psbt.addOutput({
  address: changeAddress,  
  value: changeAmount,  
});

psbt.signInput(0, bob);

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

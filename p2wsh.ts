import ECPairFactory from 'ecpair';
import * as ecc from 'tiny-secp256k1';
import * as bitcoin from "bitcoinjs-lib";
import axios from "axios";
import "dotenv/config.js";


// load environment variables
const alicePriKey = process.env.ALICE_PRIVATE_KEY || "";
const bobPriKey = process.env.BOB_PRIVATE_KEY || "";


// keypairs generation
const ECPair = ECPairFactory(ecc);
const network = bitcoin.networks.testnet;

// mt7GVM7AAhPFsovEyfyhEy97oFiynDoZbr(P2PKH)
const alice = ECPair.fromWIF(alicePriKey, network);

// Show the conversion process from pubkey to address
const changeAddress =
  bitcoin.payments.p2pkh({
    hash: bitcoin.crypto.hash160(alice.publicKey),
    network,
  }).address || "mt7GVM7AAhPFsovEyfyhEy97oFiynDoZbr";

//  mkmYsvm3tU1meB8nR2z7Hwd3FyEAR2FTNU(P2PKH)
const bob = ECPair.fromWIF(
  bobPriKey,
  network
);

const bobAddress =
  bitcoin.payments.p2pkh({
    hash: bitcoin.crypto.hash160(bob.publicKey),
    network,
  }).address || "mkmYsvm3tU1meB8nR2z7Hwd3FyEAR2FTNU";

console.log(
  `alice: ${changeAddress} matches: ${
    changeAddress === "mt7GVM7AAhPFsovEyfyhEy97oFiynDoZbr"
  }`
);
console.log(`bob: ${bobAddress} matches: ${bobAddress === "mkmYsvm3tU1meB8nR2z7Hwd3FyEAR2FTNU"}`);




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



// Set inputs and outputs for transactions
const psbt = new bitcoin.Psbt({network});

// Add input (you need to provide actual txid and output index)
psbt.addInput({
  // The hash of the previous transaction is currently manually obtained through the following methods: txid as hash and vout as index. You can use axios to automatically obtain and piece together utxo.
  //  https://blockstream.info/testnet/api/address/mt7GVM7AAhPFsovEyfyhEy97oFiynDoZbr/utxo
  // [
  //   {
  //     "txid": "e72776106f81717154d9ad1c027bef05c1f62915d7715e66aec0e626b08350bc",
  //     "vout": 1,
  //     "status": {
  //     "confirmed": true,
  //       "block_height": 2809915,
  //       "block_hash": "00000000000003f9fe432deadb828f8acb820faa01b71bd3f8ce6f63e22484c1",
  //       "block_time": 1714539347
  //     },
  //     "value": 99994000
  //   }
  // ]
  hash: "e72776106f81717154d9ad1c027bef05c1f62915d7715e66aec0e626b08350bc",
  index: 1, // UTXO output index vout
  // Full HEX of previous transaction
  // https://mempool.space/testnet/api/tx/e72776106f81717154d9ad1c027bef05c1f62915d7715e66aec0e626b08350bc/hex
  // 0200000001e0a38c99b7bb30e3ab2cc24250d6bda124f0ae89dd5c4b7e2c7cc43659b04816000000006b483045022100890a01ab9c0e5f6a4a77971f680db74ffe2580d239ca1d0b79d27892a70906a702207ec338662d3f60515b99ffa9df62ad011824159d70fc6be89485b8c4d39aef91012103dedc787d8729d6c8db498053d57c083a58974a7b24208f20bb3eb5666e4a83aeffffffff0288130000000000002200204e6598fa04c5de495c4a99db4b65a83aa325cb7469574e1798fd2bbfa54bbd4a90c9f505000000001976a9148a1ed71d3077b979f375f817147cbcc5736141b388ac00000000
  nonWitnessUtxo: Buffer.from(
    "0200000001e0a38c99b7bb30e3ab2cc24250d6bda124f0ae89dd5c4b7e2c7cc43659b04816000000006b483045022100890a01ab9c0e5f6a4a77971f680db74ffe2580d239ca1d0b79d27892a70906a702207ec338662d3f60515b99ffa9df62ad011824159d70fc6be89485b8c4d39aef91012103dedc787d8729d6c8db498053d57c083a58974a7b24208f20bb3eb5666e4a83aeffffffff0288130000000000002200204e6598fa04c5de495c4a99db4b65a83aa325cb7469574e1798fd2bbfa54bbd4a90c9f505000000001976a9148a1ed71d3077b979f375f817147cbcc5736141b388ac00000000",
    "hex"
  ),
});

const fee = 1000;
const sendAmount = 5000;
const utxoAmount = 99994000;


const escrowP2WSHAddress = escrowP2WSH.address || "";
console.log("P2WSH Address:", escrowP2WSHAddress);
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
psbt.signInput(0, alice);

// Complete PSBT
psbt.finalizeAllInputs();


// Extract the hex format of the transaction
const txHex = psbt.extractTransaction().toHex();

console.log(`Transaction Hex: ${txHex}`);
 
// broadcast
const url = 'https://blockstream.info/testnet/api/tx';  // Blockstream’s Testnet API
axios
  .post(url, txHex)
  .then((response) => {
    console.log("Transaction broadcasted! TXID:", response.data);
  })
  .catch((error) => {
    console.error("Failed to broadcast transaction:", error.response.data);
  });

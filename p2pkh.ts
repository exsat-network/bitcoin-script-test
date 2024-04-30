import ECPairFactory from "ecpair";
import * as ecc from "tiny-secp256k1";
import * as bitcoin from "bitcoinjs-lib";
import "dotenv/config.js";

// load environment variables
const alicePriKey = process.env.ALICE_PRIVATE_KEY || "";
const bobPriKey = process.env.BOB_PRIVATE_KEY || "";

// keypairs generation
const ECPair = ECPairFactory(ecc);
const network = bitcoin.networks.testnet;

// ms2qJFTv3vNom4rPXx3okbZqnvmRuGpnSV(P2PKH)
const alice = ECPair.fromWIF(alicePriKey, network);

const changePubkeyHash = bitcoin.crypto.hash160(alice.publicKey);

// Show the conversion process from pubkey to address
const changeAddress =
  bitcoin.payments.p2pkh({
    hash: bitcoin.crypto.hash160(changePubkeyHash),
    network,
  }).address || "ms2qJFTv3vNom4rPXx3okbZqnvmRuGpnSV";

//  mxSVk5XH7hHZzcczQecprzBDss6Ksx3pzT(P2PKH)
const bob = ECPair.fromWIF(
  bobPriKey,
  network
);

const escrowPubkeyHash = bitcoin.crypto.hash160(bob.publicKey);

const escrowAddress =
  bitcoin.payments.p2pkh({
    hash: escrowPubkeyHash,
    network,
  }).address || "mxSVk5XH7hHZzcczQecprzBDss6Ksx3pzT";

// Prepare custom script
const eosAccount = "miner.enf";
const eosPubkey = "PUB_K1_8bxdSx2gET6suSZxz6dWoxux2ysNG3ADJu3n5nWvMEQ6vvRXtS";
const customScript = bitcoin.script.compile([
  Buffer.from(eosAccount),
  bitcoin.opcodes.OP_DROP,
  Buffer.from(eosPubkey),
  bitcoin.opcodes.OP_DROP,
  bitcoin.opcodes.OP_DUP,
  bitcoin.opcodes.OP_HASH160,
  escrowPubkeyHash,
  bitcoin.opcodes.OP_EQUAL,
  bitcoin.opcodes.OP_CHECKSIG,
]);

// Set inputs and outputs for transactions
const psbt = new bitcoin.Psbt({ network });

// Add input (you need to provide actual txid and output index)
psbt.addInput({
  //  The hash of the previous transaction is currently manually obtained through the following methods: txid as hash and vout as index. You can use axios to automatically obtain and piece together utxo.
  //  https://blockstream.info/testnet/api/address/ms2qJFTv3vNom4rPXx3okbZqnvmRuGpnSV/utxo
  // [
  //   {
  //     txid: "e3831bd458f65d062fcbf8420648f2b7b03018ecc459e65aa735b58a38894063",
  //     vout: 0,
  //     status: {
  //       confirmed: true,
  //       block_height: 2808761,
  //       block_hash:
  //         "00000000000003d180044f8de4555faf7dd886c0bcdf1314d64412ea2fca3b93",
  //       block_time: 1714489470,
  //     },
  //     value: 100000000,
  //   },
  // ];
  hash: "e3831bd458f65d062fcbf8420648f2b7b03018ecc459e65aa735b58a38894063",
  index: 0, // UTXO output index vout
  // For non-segwit inputs, you need to provide the raw data of the entire previous transaction (nonWitnessUtxo)
  // https://mempool.space/testnet/api/tx/e3831bd458f65d062fcbf8420648f2b7b03018ecc459e65aa735b58a38894063/hex
  // 02000000000101a4ea800296f450c8ccf3bfc65ec79028506c0cbdb41e676cf66d91f8c37e8a8e0100000000ffffffff0200e1f505000000001976a9147e5005a15434d31df14c24cb7d2efd52240b8cd688ac96a9872800000000160014b0761dd31152d4b9a6fe3711c51b89eaa571de0802483045022100836f9842ddae0050baa1b1b53ddc2f0bbe7e4f5c53c24b41388b826f9d62a88802203286b34e106589c75fb056ee9930e286af57ea98886332c92dc9a6fb7050f964012102fead363b42f65d39624b0ca2d3aa9f249597515ecd9ad4e6c541bbc544ab634800000000
  nonWitnessUtxo: Buffer.from(
    "02000000000101a4ea800296f450c8ccf3bfc65ec79028506c0cbdb41e676cf66d91f8c37e8a8e0100000000ffffffff0200e1f505000000001976a9147e5005a15434d31df14c24cb7d2efd52240b8cd688ac96a9872800000000160014b0761dd31152d4b9a6fe3711c51b89eaa571de0802483045022100836f9842ddae0050baa1b1b53ddc2f0bbe7e4f5c53c24b41388b826f9d62a88802203286b34e106589c75fb056ee9930e286af57ea98886332c92dc9a6fb7050f964012102fead363b42f65d39624b0ca2d3aa9f249597515ecd9ad4e6c541bbc544ab634800000000",
    "hex"
  ),
  redeemScript: customScript, // Custom redemption script
});

const fee = 500;
const sendAmount = 2000;
const utxoAmount = 100000000;

// Add output
psbt.addOutput({
  address: escrowAddress, // Payee Address
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
//     throw new Error(`Can not finalize input #${inputIndex}`);
//     ^
// Error: Can not finalize input #0

// Extract the hex format of the transaction
const txHex = psbt.extractTransaction().toHex();

console.log(`Transaction Hex: ${txHex}`);

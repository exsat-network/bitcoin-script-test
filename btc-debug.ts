// import console from 'node:console'

import * as bitcoin from 'bitcoinjs-lib'
import { fromBech32 } from 'bitcoinjs-lib/src/address'
import ECPairFactory from 'ecpair'
import * as ecc from 'tiny-secp256k1'
import { initEccLib } from "bitcoinjs-lib";
const ECPair = ECPairFactory(ecc)
const network = bitcoin.networks.testnet

const keypair = ECPair.makeRandom({ network })
const { address } = bitcoin.payments.p2pkh({ pubkey: keypair.publicKey , network})
initEccLib(ecc);

const inputs = [
  {
    txid: 'cfe6e3cc1bed628c5ae10fca75b010b0074045da3c477e1729805e1b9a43a7fa',
    value: 237004,
    index: 1,
  },
]

const output = {
  // address: "tb1q69ajlcza24nqf0atqu635r8jfyg0slm0j6e3r6s08wn6nys9pyjsgvlqju",
  address: "tb1payy6wra7q5fu22upe4y38rnn0g3q37uqx2ghtrdh70pswf9shpgsunwts8",
  value: 555,
};

const tx = new bitcoin.Psbt({ network });
for (const input of inputs)
  tx.addInput({
    hash: input.txid,
    index: input.index,
  });
// let base32 = fromBech32(output.address);
//  let output11 = bitcoin.payments.p2tr({ pubkey: base32.data }).output;
//  console.log(output11)
tx.addOutput({ address: output.address , value: output.value });

console.log(tx.toHex())

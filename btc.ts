import console from 'node:console'

import * as bitcoin from 'bitcoinjs-lib'
import ECPairFactory from 'ecpair'
import * as ecc from 'tiny-secp256k1'
import * as varuint from 'varuint-bitcoin'

function witnessStackToScriptWitness(witness: Buffer[]) {
  let buffer = Buffer.allocUnsafe(0)

  function writeSlice(slice: Buffer) {
    buffer = Buffer.concat([buffer, Buffer.from(slice)])
  }

  function writeVarInt(i: number) {
    const currentLen = buffer.length
    const varintLen = varuint.encodingLength(i)

    buffer = Buffer.concat([buffer, Buffer.allocUnsafe(varintLen)])
    varuint.encode(i, buffer, currentLen)
  }

  function writeVarSlice(slice: Buffer) {
    writeVarInt(slice.length)
    writeSlice(slice)
  }

  function writeVector(vector: Buffer[]) {
    writeVarInt(vector.length)
    vector.forEach(writeVarSlice)
  }

  writeVector(witness)

  return buffer
}

const ECPair = ECPairFactory(ecc)
const network = bitcoin.networks.testnet
bitcoin.initEccLib(ecc)

const keypair = ECPair.fromWIF('cQHMgmi8sDuR9BFeCtZdWdpUk9PyqfWn8QAgCjnKuukxTdbRiRRS', network)

const keypair2 = ECPair.fromWIF('cN8iAfQz5zRpDhSLwDQ9EgYEfCf7mNWfHPKqQLcehC5gdp68vyW3', network)

const { address } = bitcoin.payments.p2pkh({ pubkey: keypair.publicKey })

const inputs = [{
  txid: '72feecdfe241314954eda358904946b12633087e23c9fba491e08c5c713b4407',
  value: 24000,
  index: 1,
  script: '0b74657374322e65787361747576a914ce65a80b68e5b1eb690cb8b6c9527cedfdd3179588ac',
  eosAccount: 'test2.exsat',
}]

const output = {
  address: 'tb1payy6wra7q5fu22upe4y38rnn0g3q37uqx2ghtrdh70pswf9shpgsunwts8',
  value: 100,
}
const change = {
  address: 'tb1ql3qfudf8kxx0rdvuxjv89h5z3rgueqhe7rh3wczwe5j8wwwcysyskkukvh',
  value: 18000,
}

// 创建交易
const pubkeys = [keypair.publicKey, keypair2.publicKey]
const tx = new bitcoin.Psbt({ network })
for (const input of inputs) {
  const lockScript = bitcoin.script.compile([
    Buffer.from(input.eosAccount, 'utf8'),
    bitcoin.opcodes.OP_DROP,
    bitcoin.opcodes.OP_DUP,
    bitcoin.opcodes.OP_2,
    keypair.publicKey,
    keypair2.publicKey,
    bitcoin.opcodes.OP_2,
    bitcoin.opcodes.OP_CHECKMULTISIG,
  ])
  console.log(`script-hex:${lockScript.toString('hex')}`)
  const escrowP2WSH = bitcoin.payments.p2wsh({
    redeem: { output: Buffer.from(input.script, 'hex'), network, m: 2, pubkeys: [keypair.publicKey, keypair2.publicKey] },
    network,
  })
  console.log(escrowP2WSH.address)
  tx.addInput({ hash: input.txid, index: input.index, witnessUtxo: { script: escrowP2WSH.output, value: input.value }, witnessScript: lockScript })
}
tx.addOutput({ address: output.address, value: output.value })
// 找零输入
tx.addOutput({ address: change.address, value: change.value })

function finalizeInput(_inputIndex: number, input: any) {
  const redeemPayment = bitcoin.payments.p2wsh({
    redeem: {
      input: bitcoin.script.compile([
        // redeem scripts
        input.partialSig[0].signature,
        keypair.publicKey,
        input.partialSig[1].signature,
        keypair2.publicKey,
      ]),
      output: input.witnessScript,
    },
  })

  const finalScriptWitness = witnessStackToScriptWitness(
    redeemPayment.witness ?? [],
  )

  return {
    finalScriptSig: Buffer.from(''),
    finalScriptWitness,
  }
}

tx.signAllInputs(keypair)

tx.finalizeAllInputs()
// tx.finalizeInput(1, finalizeInput)
// tx.finalizeInput(1, finalizeInput)

const hx = tx.extractTransaction().toHex()

/*
const pushtxUrl = 'https://blockstream.info/testnet/api/tx'
axios.post(pushtxUrl, hx)
  .then((response) => {
    console.log(response.data)
  })
  .catch((error) => {
    console.error(error)
  }) */

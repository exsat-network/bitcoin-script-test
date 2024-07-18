import {initEccLib, networks} from "bitcoinjs-lib";
import * as bitcoin from "bitcoinjs-lib";
import {sha256} from "bitcoinjs-lib/src/crypto";

import * as ecc from "tiny-secp256k1";
import axios from "axios";

initEccLib(ecc);

function addressToScriptHash(address: string, network: networks.Network) {
    const scriptHash = bitcoin.address.toOutputScript(address, network)
    const hash = sha256(scriptHash).reverse()
    return hash.toString('hex')
}


function getUtxo(address: string) {
    const scriptHash = addressToScriptHash(address, networks.regtest)
    axios.get(`http://atomicals.regtest.exactsat.io/proxy/blockchain.scripthash.listunspent?params=["${scriptHash}"]`)
        .then((response) => {
            console.log(`response.status=${response.status}`)
            console.log('response.data:', response.data);
        })
        .catch((error) => {
            console.error('Error:', error);
        });
}

getUtxo("bcrt1p60yrr0xxwve75t9utfl2atpurmm7wwkyy0qvhdcfgjfu9egkr73qdvc3ze")
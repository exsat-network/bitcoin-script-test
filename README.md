# TEST BITCOIN SCRIPT

```shell
cp .env.example .env
# change  ALICE_PRIVATE_KEY=alice-private-key-in-wif-format-here
# and  BOB_PRIVATE_KEY=bob-private-key-in-wif-format-here
# in .env

npm install 


npm run p2pkh  # fail

npm run p2wsh # success: alice(p2pkh) send bitcoin to bob(p2wsh) with custom lockscript.

npm run p2wsh_redeem # success: bob(p2wsh) with custom lockscript and redeem script send bitcoin to alice(p2pkh).
```
[P2PKH to P2WSH TXID](https://mempool.space/zh/testnet/tx/0060ffe6fae2834336d6d023944d82b1c5a7686ab62907e1447255f181514668)

[P2WSH REDEEM TXID](https://mempool.space/testnet/tx/5261721e5019f0c66c17c5a6217e1702aa02e3d0eabe42b03d7fed64c1aec655)
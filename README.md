# TEST BITCOIN SCRIPT

```shell
cp .env.example .env
# change  ALICE_PRIVATE_KEY=alice-private-key-in-wif-format-here
# and  BOB_PRIVATE_KEY=bob-private-key-in-wif-format-here
# in .env

npm install 


npm run p2pkh  # fail

npm run p2wsh # success
```
[P2WSH TEST TXID](https://mempool.space/testnet/tx/91f44ac066c2c2ad7cc865eed0ccb68632bb9f5fc6ed18bb408a16749864df12)
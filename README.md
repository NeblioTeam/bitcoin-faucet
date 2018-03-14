NEBL Faucet
==============

A Node.js app to easily create a programmable NEBL Testnet faucet. This allows you to
easily test your Neblio applications.


Installation
------------

    git clone https://github.com/NeblioTeam/nebl-faucet
    cd nebl-faucet
    npm install


Usage
-----

run:

    node ./index.js

outputs something like:

      nebl-faucet listening on port 14004
      deposit funds to: n2hBww8z4cZE68SETVTAu4BvM52EpPVo7S


### ENV VARS

You can configure the faucet with the following commands:

- `FAUCET_PORT`: defaults to `14004`
- `FAUCET_WALLET`: defaults to `~/.bitcoin-faucet/wallet`. It's a plain text file with the faucet private key in WIF.
- `PRIVKEY`: the faucet private key in WIF


### Request Funds

CURL or make browser GET request to `/withdrawal` with params `address` and optional `amount`. If amount not specified, 1 NEBL is used.

**Example**:

    http://localhost:14004/withdrawal?address=msj42CCGruhRsFrGATiUuh25dtxYtnpbTx

response:

    {
      "status": "success",
      "data": {
        "txId": "7b139bdba00cbe506087444caa899b8c94cfac4ab660e0f64a50325cb41c458c"
      }
    }


#### Why GET?

While a `POST` probably would have been proper, a `GET` is super simple to implement and
easy to make requests in the browser.


License
-------

MIT


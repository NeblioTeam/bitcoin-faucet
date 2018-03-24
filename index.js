#!/usr/bin/env node

var http = require('http')
var path = require('path')
var Blockchain = require('cb-insight')
var chalk = require('chalk')
var express = require('express')
var fs = require('fs')
var bitcoin = require('bitcoinjs-lib')

var PORT = process.env.FAUCET_PORT || process.env.PORT || 14004

var privkey = process.env.PRIVKEY

if (privkey == undefined) {
  var WALLET_FILE = process.env.FAUCET_WALLET || path.join(process.env.HOME || process.env.USERPROFILE, '.bitcoin-faucet', 'wallet')

  // initialize wallet
  if (!fs.existsSync(WALLET_FILE)) {
  	privkey = bitcoin.ECKey.makeRandom().toWIF()
    fs.writeFileSync(WALLET_FILE, privkey, 'utf-8')
  } else {
    privkey = fs.readFileSync(WALLET_FILE, 'utf-8')
  }
}

var keypair = bitcoin.ECKey.fromWIF(privkey)
var address = keypair.pub.getAddress(bitcoin.networks.neblio_testnet).toString()

var blockchain = new Blockchain('https://ntp1node.nebl.io:13002')

var app = express()
app.get('/', function (req, res) {
  var pkg = require('./package')
  res.set('Content-Type', 'text/plain')
  res.end('Neblio Testnet Faucet version: ' + pkg.version +
  	      '\n\nTestnet NEBL are not valuable, do not abuse this faucet or it will be shut down, and please return left over NEBL' +
  	      '\n\nPlease send NEBL back to: ' + address +
  	      '\n\n\nBy default this faucet issues 1 NEBL per request. You can also spcify an "amount" in satoshi to send up to 50 NEBL. ex: &amount=800000000' +
  	      '\n\nUsage: https://ntp1node.nebl.io:15000/withdrawal?address=NEBLTestnetAddressHere')
})

// only bitcoin testnet supported for now
app.get('/withdrawal', function (req, res) {
  if (!req.query.address) {
    res.status(422).send({ status: 'error', data: { message: 'You forgot to set the "address" parameter.' } })
  }

  // satoshis
  var amount = parseInt(req.query.amount, 10) || 100000000

  if (amount > 5000000000) {
  	amount = 5000000000
  }

  spend(keypair, req.query.address, amount, function (err, txId) {
    if (err) return res.status(500).send({status: 'error', data: {message: err.message}})
    res.send({status: 'success', data: {txId: txId}})
  })
})

function spend(keypair, toAddress, amount, callback) {
  blockchain.addresses.unspents(address, function (err, utxos) {
    if (err) return callback(err)

    var balance = utxos.reduce(function (amount, unspent) {
      return unspent.value + amount
    }, 0)

    if (amount > balance) {
      return callback(new Error('Faucet doesn\'t contain enough NEBL to send.'))
    }

    var tx = new bitcoin.TransactionBuilder()
    tx.addOutput(toAddress, amount)

    var change = balance - amount - 100000 // 100000 fee
    if (change > 0) {
      tx.addOutput(address, change)
    }

    utxos.forEach(function (unspent) {
      tx.addInput(unspent.txId, unspent.vout)
    })

    utxos.forEach(function (unspent, i) {
      tx.sign(i, keypair)
    })

    var txHex = tx.build().toHex()
    blockchain.transactions.propagate(txHex, function (err, result) {
      if (err) return callback(err)

      callback(null, result.txId)
    })
  })
}

var server = http.createServer(app)

server.listen(PORT, function (err) {
  if (err) console.error(err)
  console.log('\n  bitcoin-faucet listening on port %s', chalk.blue.bold(PORT))
  console.log('  deposit funds to: %s', chalk.green.bold(address))
})

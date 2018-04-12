#!/usr/bin/env node

var http = require('http')
var path = require('path')
var Blockchain = require('cb-insight')
var chalk = require('chalk')
var express = require('express')
var RateLimit = require('express-rate-limit')
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
app.enable('trust proxy')

var withdrawalLimiter = new RateLimit({
  windowMs: 24*60*60*1000, // 1 day
  max: 1,
  delayMs: 0, // disabled
  skipFailedRequests: true,
  message: "Only one withdrawal allowed per day due to this faucet being abused in the past. To request additional Testnet NEBL contact us via https://nebl.io/contact or wait 24 hours."
});

app.get('/', function (req, res) {
  var pkg = require('./package')
  res.set('Content-Type', 'text/plain')
  res.end('Neblio Testnet Faucet version: ' + pkg.version +
  	      '\n\n\n\nTESTNET NEBL ARE NOT VALUABLE. DUE TO THIS FAUCET BEING ABUSED IN THE PAST, THERE IS A 1 WITHDRAWAL PER 24 HOURS LIMIT. ' +
  	      '\n\n\n\nPlease send leftover testnet NEBL back to: ' + address +
  	      '\n\n\nBy default this faucet issues 15 NEBL per request. You can also spcify an "amount" in satoshi to send up to 50 NEBL. ex: &amount=2000000000' +
  	      '\n\nUsage: https://ntp1node.nebl.io:15000/withdrawal?address=NEBLTestnetAddressHere' +
  	      '\n\n\nTo request additional or large amounts of Testnet NEBL for legitimate projects, contact us via https://nebl.io/contact')
})

// only bitcoin testnet supported for now
app.get('/withdrawal', withdrawalLimiter, function (req, res) {
  if (!req.query.address) {
    res.status(422).send({ status: 'error', data: { message: 'You forgot to set the "address" parameter.' } })
  }

  // satoshis
  var amount = parseInt(req.query.amount, 10) || 1500000000

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

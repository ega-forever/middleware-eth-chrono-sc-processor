/**
 * Copyright 2017–2018, LaborX PTY
 * Licensed under the AGPL Version 3 license.
 * @author Egor Zuev <zyev.egor@gmail.com>
 */

require('dotenv/config');

const _ = require('lodash'),
  spawn = require('child_process').spawn,
  expect = require('chai').expect,
  Promise = require('bluebird');

module.exports = (ctx) => {

  before(async () => {

    ctx.scProcessorPid = spawn('node', ['index.js'], {env: process.env, stdio: 'inherit'});
    await Promise.delay(5000);
  });

  it('set oracle address and price', async () => {

    const contractOracle = await ctx.contracts.WalletsManager.methods.getOracleAddress.call();

    if (contractOracle !== ctx.accounts[0]) {
      const setOracleAddressTxEstimateGas = await ctx.contracts.WalletsManager.methods.setOracleAddress(ctx.accounts[0]).estimateGas({from: ctx.accounts[0]});

      const setOracleAddressTx = await ctx.contracts.WalletsManager.methods.setOracleAddress(ctx.accounts[0]).send({
        from: ctx.accounts[0],
        gas: parseInt(setOracleAddressTxEstimateGas * 1.2)
      });

      expect(setOracleAddressTx.transactionHash).to.be.a('string');
    }

    const estimatePrice = 3000000000 * 300000;
    const price = await ctx.contracts.WalletsManager.methods.getOraclePrice.call();

    if (parseInt(price.toString()) !== estimatePrice) {
      const setOraclePriceTxEstimateGas = await ctx.contracts.WalletsManager.methods.setOraclePrice(estimatePrice).estimateGas({from: ctx.accounts[0]});
      await ctx.contracts.WalletsManager.methods.setOraclePrice(estimatePrice).send({
        from: ctx.accounts[0],
        gas: parseInt(setOraclePriceTxEstimateGas * 1.2)
      });
    }
  });

  it('check filterTxsBySMEventsService function', async () => {

    const filterTxsBySMEventsService = require('../../services/filterTxsBySMEventsService'); //require inline because it has dep of smart contracts, which are unavailable on start

    const walletCreationEstimateGasPrice = await ctx.contracts.WalletsManager.methods.create2FAWallet(0).estimateGas({from: ctx.accounts[0]});

    let createWalletTx = await ctx.contracts.WalletsManager.methods.create2FAWallet(0).send({
      from: ctx.accounts[0],
      gas: parseInt(walletCreationEstimateGasPrice * 1.5)
    });


    expect(createWalletTx.transactionHash).to.be.a('string');

    const tx = await ctx.web3.eth.getTransaction(createWalletTx.transactionHash);
    const receipt = await ctx.web3.eth.getTransactionReceipt(createWalletTx.transactionHash);
    tx.logs = receipt.logs;

    expect(createWalletTx.events.WalletCreated).to.be.an('object');

    const event = {
      info: {
        tx: tx.hash,
        blockNumber: tx.blockNumber
      },
      name: 'WalletCreated',
      payload: _.chain(createWalletTx.events.WalletCreated.returnValues)
        .toPairs()
        .filter(pair => _.isNaN(parseInt(pair[0])))
        .map(pair => {
          if (_.isString(pair[1]))
            pair[1] = pair[1].toLowerCase();
          return pair;
        })
        .fromPairs()
        .value()
    };

    const filtered = filterTxsBySMEventsService(tx);

    let filteredEvent = _.find(filtered, {name: event.name});

    expect(filtered.length).to.eq(tx.logs.length);
    expect(_.isEqual(filteredEvent, event)).to.eq(true);
  });


  after(async () => {
    ctx.scProcessorPid.kill();
  });
};

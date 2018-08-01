/**
 * Copyright 2017–2018, LaborX PTY
 * Licensed under the AGPL Version 3 license.
 * @author Egor Zuev <zyev.egor@gmail.com>
 */

require('dotenv/config');

const _ = require('lodash'),
  filterTxsBySMEventsService = require('../../services/filterTxsBySMEventsService'),
  spawn = require('child_process').spawn,
  expect = require('chai').expect,
  memwatch = require('memwatch-next'),
  Promise = require('bluebird');

module.exports = (ctx) => {

  before(async () => {

    ctx.scProcessorPid = spawn('node', ['index.js'], {env: process.env, stdio: 'inherit'});
    await Promise.delay(5000);
  });

  it('set oracle address and price', async () => {

    ctx.contracts.WalletsManager.setProvider(ctx.web3.currentProvider);
    ctx.contracts.Wallet.setProvider(ctx.web3.currentProvider);

    let walletsManager = await ctx.contracts.WalletsManager.deployed();
    const contractOracle = await walletsManager.getOracleAddress();

    if (contractOracle !== ctx.accounts[0]) {
      const setOracleAddressTxEstimateGas = await walletsManager.setOracleAddress.estimateGas(ctx.accounts[0]);

      const setOracleAddressTx = await walletsManager.setOracleAddress(ctx.accounts[0], {
        from: ctx.accounts[0],
        gas: parseInt(setOracleAddressTxEstimateGas * 1.2)
      });

      expect(setOracleAddressTx.tx).to.be.a('string');

      await new Promise(res => {
        let intervalId = setInterval(async () => {
          if (!setOracleAddressTx)
            return;
          let tx = await Promise.promisify(ctx.web3.eth.getTransaction)(setOracleAddressTx.tx);
          if (tx.blockNumber) {
            clearInterval(intervalId);
            res();
          }
        }, 1000);
      });

    }

    const estimatePrice = 3000000000 * 300000;
    const price = await walletsManager.getOraclePrice();

    if (parseInt(price.toString()) !== estimatePrice) {
      const setOraclePriceTxEstimateGas = await walletsManager.setOraclePrice.estimateGas(estimatePrice);
      await walletsManager.setOraclePrice(estimatePrice, {
        from: ctx.accounts[0],
        gas: parseInt(setOraclePriceTxEstimateGas * 1.2)
      });
    }
  });

  it('check filterTxsBySMEventsService function performance', async () => {

    ctx.contracts.WalletsManager.setProvider(ctx.web3.currentProvider);
    const walletsManager = await ctx.contracts.WalletsManager.deployed();
    const walletCreationEstimateGasPrice = await walletsManager.create2FAWallet.estimateGas(0);

    let createWalletTx = await walletsManager.create2FAWallet(0, {
      from: ctx.accounts[0],
      gas: parseInt(walletCreationEstimateGasPrice * 1.5)
    });

    expect(createWalletTx.tx).to.be.a('string');

    await new Promise(res => {
      let intervalId = setInterval(async () => {
        if (!createWalletTx)
          return;
        let tx = await Promise.promisify(ctx.web3.eth.getTransaction)(createWalletTx.tx);
        if (tx.blockNumber) {
          clearInterval(intervalId);
          res();
        }
      }, 1000);
    });

    const tx = await Promise.promisify(ctx.web3.eth.getTransaction)(createWalletTx.tx);
    const receipt = await Promise.promisify(ctx.web3.eth.getTransactionReceipt)(createWalletTx.tx);
    tx.logs = _.chain(new Array(1000))
      .fill(0)
      .map(()=>_.clone(receipt.logs[0]))
      .value();

    const walletLog = _.find(createWalletTx.logs, {event: 'WalletCreated'});
    expect(walletLog).to.be.an('object');

    let hd = new memwatch.HeapDiff();
    const start = Date.now();

    filterTxsBySMEventsService(tx);

    expect(Date.now() - start).to.be.below(1000);

    let diff = hd.end();
    let leakObjects = _.filter(diff.change.details, detail => detail.size_bytes / 1024 / 1024 > 3);
    expect(leakObjects.length).to.be.eq(0);
  });


  after(async () => {
    ctx.scProcessorPid.kill();
  });
};

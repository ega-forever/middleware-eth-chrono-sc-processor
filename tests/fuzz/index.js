/**
 * Copyright 2017–2018, LaborX PTY
 * Licensed under the AGPL Version 3 license.
 * @author Egor Zuev <zyev.egor@gmail.com>
 */

require('dotenv/config');

const _ = require('lodash'),
  config = require('../../config'),
  spawn = require('child_process').spawn,
  expect = require('chai').expect,
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

  it('create wallet', async () => {

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
    tx.logs = receipt.logs;

    const walletLog = _.find(createWalletTx.logs, {event: 'WalletCreated'});
    expect(walletLog).to.be.an('object');

    const event = {
      name: walletLog.event,
      payload: walletLog.args
    };

    await Promise.all([
      (async () => {
        await Promise.delay(3000);
        await ctx.amqp.channel.publish('events', `${config.rabbit.serviceName}_transaction.${tx.logs[0].address}`, new Buffer(JSON.stringify(tx)));
      })(),
      (async () => {
        await ctx.amqp.channel.assertQueue(`app_${config.rabbit.serviceName}_test_features.sc_processor`);
        await ctx.amqp.channel.bindQueue(`app_${config.rabbit.serviceName}_test_features.sc_processor`, 'events', `${config.rabbit.serviceName}_chrono_sc.*`);
        await new Promise(res =>
          ctx.amqp.channel.consume(`app_${config.rabbit.serviceName}_test_features.sc_processor`, async data => {

            if (!data)
              return;

            const message = JSON.parse(data.content.toString());

            expect(_.isEqual(event, message)).to.equal(true);
            await ctx.amqp.channel.deleteQueue(`app_${config.rabbit.serviceName}_test_features.sc_processor`);
            res();
          }, {noAck: true})
        );

      })()
    ]);
  });

  it('kill scProcessor and create another wallet', async () => {

    ctx.scProcessorPid.kill();

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
    tx.logs = receipt.logs;

    const walletLog = _.find(createWalletTx.logs, {event: 'WalletCreated'});
    expect(walletLog).to.be.an('object');

    ctx.event = {
      name: walletLog.event,
      payload: walletLog.args
    };

    await ctx.amqp.channel.publish('events', `${config.rabbit.serviceName}_transaction.${tx.logs[0].address}`, new Buffer(JSON.stringify(tx)));
  });

  it('start scProcessor and check for notification', async () => {

    ctx.scProcessorPid = spawn('node', ['index.js'], {env: process.env, stdio: 'inherit'});

    await ctx.amqp.channel.assertQueue(`app_${config.rabbit.serviceName}_test_features.sc_processor`);
    await ctx.amqp.channel.bindQueue(`app_${config.rabbit.serviceName}_test_features.sc_processor`, 'events', `${config.rabbit.serviceName}_chrono_sc.*`);
    await new Promise(res =>
      ctx.amqp.channel.consume(`app_${config.rabbit.serviceName}_test_features.sc_processor`, async data => {

        if (!data)
          return;

        const message = JSON.parse(data.content.toString());

        expect(_.isEqual(ctx.event, message)).to.equal(true);
        await ctx.amqp.channel.deleteQueue(`app_${config.rabbit.serviceName}_test_features.sc_processor`);
        res();
      }, {noAck: true})
    );
  });


  after(async () => {
    delete ctx.event;
    ctx.scProcessorPid.kill();
  });
};

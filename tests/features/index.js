/**
 * Copyright 2017–2018, LaborX PTY
 * Licensed under the AGPL Version 3 license.
 * @author Egor Zuev <zyev.egor@gmail.com>
 */

require('dotenv/config');

const _ = require('lodash'),
  accountModel = require('../../models/accountModel'),
  config = require('../../config'),
  spawn = require('child_process').spawn,
  expect = require('chai').expect,
  Promise = require('bluebird');

module.exports = (ctx) => {

  before(async () => {

    ctx.scProcessorPid = spawn('node', ['index.js'], {env: process.env, stdio: 'inherit'});
    await Promise.delay(5000);
  });

  it('check that account has been created', async () => {
    const isExist = await accountModel.count({address: ctx.scFactory.address});
    expect(isExist).to.eq(1);
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

  it('create wallet', async () => {

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


    await Promise.all([
      (async () => {
        await Promise.delay(3000);
        await ctx.amqp.channel.publish('events', `${config.rabbit.serviceName}_transaction.${tx.logs[0].address.toLowerCase()}`, new Buffer(JSON.stringify(tx)));
      })(),
      (async () => {
        await ctx.amqp.channel.assertQueue(`app_${config.rabbit.serviceName}_test_features.sc_processor`, {autoDelete: true});
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


  after(async () => {
    ctx.scProcessorPid.kill();
  });
};

require('dotenv/config');

const config = require('../config'),
  expect = require('chai').expect,
  helpers = require('./helpers'),
  net = require('net'),
  path = require('path'),
  require_all = require('require-all'),
  contract = require('truffle-contract'),
  _ = require('lodash'),
  contracts = require_all({
    dirname: _.nth(require.resolve('chronobank-smart-contracts/build/contracts/MultiEventsHistory').match(/.+(?=MultiEventsHistory)/), 0),
    filter: /(^((ChronoBankPlatformEmitter)|(?!(Emitter|Interface)).)*)\.json$/,
    resolve: Contract => contract(Contract)
  }),
  Web3 = require('web3'),
  web3 = new Web3(),
  Promise = require('bluebird'),
  smEvents = require('../controllers/eventsCtrl')(contracts),
  mongoose = require('mongoose');

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

describe('core/sc processor', function () {

  before(async () => {
    let provider = new Web3.providers.IpcProvider(config.web3.uri, net);
    web3.setProvider(provider);
    mongoose.connect(config.mongo.uri);


    for (let contract_name in contracts)
      if (contracts.hasOwnProperty(contract_name)) {
        try {
          contracts[contract_name].setProvider(provider);
          contracts[`${contract_name}Instance`] = await contracts[contract_name].deployed();
        } catch (e) {

        }
      }

    return await helpers.awaitLastBlock(web3);
  });

  after(() => {
    web3.currentProvider.connection.end();
    return mongoose.disconnect();
  });

  it('add account to mongo', async () => {
    let accounts = await Promise.promisify(web3.eth.getAccounts)();
    try {
      await new accountModel({address: accounts[0]}).save();
    } catch (e) {
    }
  });


  it('add TIME Asset', async () => {

    let accounts = await Promise.promisify(web3.eth.getAccounts)();
    let result = await contracts.AssetsManagerInstance.addAsset(
      contracts.ChronoBankAssetProxyInstance.address, 'TIME', accounts[0], {
        from: accounts[0],
        gas: 3000000
      });

    expect(result).to.have.own.property('tx');

  });

  it('send 100 TIME to owner1 from owner', async () => {

    let accounts = await Promise.promisify(web3.eth.getAccounts)();
    let result = await contracts.AssetsManagerInstance.sendAsset(
      helpers.bytes32('TIME'), accounts[1], 100, {
        from: accounts[0],
        gas: 3000000
      });

    expect(result).to.have.own.property('tx');

  });

  it('validate tx in mongo', async () => {
    await Promise.delay(10000);
    let accounts = await Promise.promisify(web3.eth.getAccounts)();

    let result = await smEvents.eventModels.Transfer.findOne({
      symbol: helpers.bytes32('TIME'),
      to: accounts[1]
    });

    expect(result).to.have.property('to');
  });

});

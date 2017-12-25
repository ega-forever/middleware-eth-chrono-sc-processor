require('dotenv/config');

const config = require('../config'),
  mongoose = require('mongoose'),
  Promise = require('bluebird');

mongoose.Promise = Promise; // Use custom Promises
mongoose.connect(config.mongo.data.uri, {useMongoClient: true});
mongoose.accounts = mongoose.createConnection(config.mongo.accounts.uri);

const expect = require('chai').expect,
  awaitLastBlock = require('./helpers/awaitLastBlock'),
  bytes32 = require('./helpers/bytes32'),
  net = require('net'),
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
  accountModel = require('../models/accountModel'),
  smEvents = require('../controllers/eventsCtrl')(contracts),
  ctx = {};

describe('core/sc processor', function () {

  before(async () => {
    let provider = new Web3.providers.IpcProvider(config.web3.uri, net);
    web3.setProvider(provider);

    for (let contract_name in contracts) {
      if (contracts.hasOwnProperty(contract_name)) {
        try {
          contracts[contract_name].setProvider(provider);
          contracts[`${contract_name}Instance`] = await contracts[contract_name].deployed();
        } catch (e) {

        }
      }
    }

    return await awaitLastBlock(web3);
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
    let result = await contracts.UserManagerInstance.addCBE(
      accounts[1], 0x0, {
        from: accounts[0],
        gas: 3000000
      });

    expect(result).to.have.own.property('tx');
    ctx.log = result.logs[0];
    ctx.log.args = JSON.parse(JSON.stringify(ctx.log.args));
  });

  it('validate tx in mongo', async () => {
    await Promise.delay(20000);
    let result = await smEvents.eventModels[ctx.log.event].findOne(ctx.log.args);

    expect(result).to.be.an('object');
  });

});

/**
 * Copyright 2017–2018, LaborX PTY
 * Licensed under the AGPL Version 3 license.
 * @author Egor Zuev <zyev.egor@gmail.com>
 */

require('dotenv/config');
process.env.LOG_LEVEL = 'error';

const config = require('../config'),
  _ = require('lodash'),
  contract = require('truffle-contract'),
  requireAll = require('require-all'),
  fs = require('fs-extra'),
  spawn = require('child_process').spawn,
  fuzzTests = require('./fuzz'),
  performanceTests = require('./performance'),
  featuresTests = require('./features'),
  blockTests = require('./blocks'),
  Promise = require('bluebird'),
  path = require('path'),
  Web3 = require('web3'),
  net = require('net'),
  dbPath = path.join(__dirname, 'utils/node/testrpc_db'),
  contractPath = path.join(__dirname, '../node_modules/chronobank-smart-contracts'),
  contractBuildPath = path.join(contractPath, 'build'),
  mongoose = require('mongoose'),
  amqp = require('amqplib'),
  ctx = {};

mongoose.Promise = Promise; // Use custom Promises
mongoose.connect(config.mongo.accounts.uri, {useMongoClient: true});

describe('plugins/chronoScProcessor', function () {

  before(async () => {

    ctx.amqp = {};
    ctx.amqp.instance = await amqp.connect(config.rabbit.url);
    ctx.amqp.channel = await ctx.amqp.instance.createChannel();
    await ctx.amqp.channel.assertExchange('events', 'topic', {durable: false});

    const isDbExist = fs.existsSync(dbPath);

    ctx.nodePid = spawn('node', ['--max_old_space_size=4096', 'tests/utils/node/ipcConverter.js'], {
      env: process.env,
      stdio: 'inherit'
    });
    await Promise.delay(5000);

    ctx.nodePid.on('exit', function (code, signal) {
      console.log(`node has gone!`);
      console.log(code, signal);
      process.exit(1);
    });


    ctx.checkerPid = spawn('node', ['tests/utils/proxyChecker.js'], {
      env: process.env, stdio: 'ignore'
    });


    if (fs.existsSync(path.join(contractPath, 'migrations-dev-full'))) {
      await fs.remove(contractBuildPath);
      fs.removeSync(path.join(contractPath, 'migrations'));
      fs.moveSync(path.join(contractPath, 'migrations-dev-full'), path.join(contractPath, 'migrations'), {});
    }


    if (!fs.existsSync(contractBuildPath) || !isDbExist) {

      await fs.remove(contractBuildPath);

      const contractDeployPid = spawn('node', ['../truffle/build/cli.bundled.js', 'migrate'], {
        env: process.env,
        stdio: 'inherit',
        cwd: 'node_modules/chronobank-smart-contracts'
      });

      await new Promise(res =>
        contractDeployPid.on('exit', function (code, signal) {
          console.log(`child process exited with code ${code} and signal ${signal}`);
          res();
        })
      );
    }

    ctx.contracts = requireAll({
      dirname: path.resolve(__dirname, '../node_modules/chronobank-smart-contracts/build/contracts'),
      resolve: Contract => contract(Contract)
    });


    const web3ProviderUri = process.env.WEB3_TEST_URI || process.env.WEB3_URI || '/tmp/development/geth.ipc';

    const provider = /http:\/\//.test(web3ProviderUri) ?
      new Web3.providers.HttpProvider(web3ProviderUri) :
      new Web3.providers.IpcProvider(`${/^win/.test(process.platform) ? '\\\\.\\pipe\\' : ''}${web3ProviderUri}`, net);

    ctx.scFactory = require('../factories/sc/smartContractsEventsFactory');
    ctx.web3 = new Web3(provider);
    ctx.accounts = await Promise.promisify(ctx.web3.eth.getAccounts)();
  });

  after(async () => {
    mongoose.disconnect();
    await ctx.amqp.instance.close();
    if (_.has(ctx.web3.currentProvider, 'connection.destroy'))
      ctx.web3.currentProvider.connection.destroy();
    ctx.nodePid.kill();
  });

  describe('block', () => blockTests(ctx));

/*  describe('features', () => featuresTests(ctx));

  describe('performance', () => performanceTests(ctx));

  describe('fuzz', () => fuzzTests(ctx));*/

});

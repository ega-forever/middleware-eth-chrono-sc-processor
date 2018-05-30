/**
 * Copyright 2017–2018, LaborX PTY
 * Licensed under the AGPL Version 3 license.
 * @author Egor Zuev <zyev.egor@gmail.com>
 */

/**
 * Middleware service for handling emitted events on chronobank platform
 * @module Chronobank/eth-chrono-sc-processor
 * @requires models/accountModel
 * @requires config
 * @requires services/filterTxsBySMEventsService
 */

const config = require('./config'),
  Promise = require('bluebird'),
  mongoose = require('mongoose');

mongoose.Promise = Promise; // Use custom Promises
mongoose.connect(config.mongo.data.uri, {useMongoClient: true});
mongoose.accounts = mongoose.createConnection(config.mongo.accounts.uri);

const accountModel = require('./models/accountModel'),
  Web3 = require('web3'),
  filterTxsBySMEventsService = require('./services/filterTxsBySMEventsService'),
  net = require('net'),
  fs = require('fs'),
  _ = require('lodash'),
  requireAll = require('require-all'),
  contract = require('truffle-contract'),
  bunyan = require('bunyan'),
  log = bunyan.createLogger({name: 'core.chronoSCProcessor'}),
  amqp = require('amqplib');

let contracts = {},
  smEvents = {};

[mongoose.accounts, mongoose.connection].forEach(connection =>
  connection.on('disconnected', function () {
    log.error('mongo disconnected!');
    process.exit(0);
  })
);

let init = async () => {

  let conn = await amqp.connect(config.rabbit.url)
    .catch(() => {
      log.error('rabbitmq is not available!');
      process.exit(0);
    });

  let channel = await conn.createChannel();

  channel.on('close', () => {
    log.error('rabbitmq process has finished!');
    process.exit(0);
  });

  let provider = new Web3.providers.IpcProvider(config.web3.uri, net);
  const web3 = new Web3();
  web3.setProvider(provider);

  web3.currentProvider.connection.on('end', () => {
    log.error('ipc process has finished!');
    process.exit(0);
  });

  web3.currentProvider.connection.on('error', () => {
    log.error('ipc process has finished!');
    process.exit(0);
  });

  if (fs.existsSync(config.smartContracts.path)) {
    contracts = requireAll({ //scan dir for all smartContracts, excluding emitters (except ChronoBankPlatformEmitter) and interfaces
      dirname: config.smartContracts.path,
      filter: /(^((ChronoBankPlatformEmitter)|(?!(Emitter|Interface)).)*)\.json$/,
      resolve: Contract => contract(Contract)
    });

    smEvents = require('./controllers/eventsCtrl')(contracts);

  }

  if (!_.has(contracts, config.smartContracts.eventContract)) {
    log.error('smart contracts are not installed!');
    return process.exit(1);
  }

  contracts[config.smartContracts.eventContract].setProvider(web3.currentProvider);
  let multiAddress = await contracts[config.smartContracts.eventContract].deployed()
    .catch(() => {
      log.error('smart contracts are not deployed!');
      return process.exit(1);
    });

  await accountModel.update({address: multiAddress.address}, {$set: {address: multiAddress.address}}, {
    upsert: true,
    setDefaultsOnInsert: true
  });

  await channel.assertExchange('events', 'topic', {durable: false});
  await channel.assertQueue(`app_${config.rabbit.serviceName}.chrono_sc_processor`);
  await channel.bindQueue(`app_${config.rabbit.serviceName}.chrono_sc_processor`, 'events', `${config.rabbit.serviceName}_transaction.${multiAddress.address}`);

  channel.prefetch(2);

  // Listen to Rabbit
  channel.consume(`app_${config.rabbit.serviceName}.chrono_sc_processor`, async (data) => {
    try {
      let block = JSON.parse(data.content.toString());
      let tx = await Promise.promisify(web3.eth.getTransactionReceipt)(block.hash || '').timeout(60000);
      let filteredEvents = tx ? await filterTxsBySMEventsService(tx, web3, multiAddress, smEvents) : [];

      for (let event of filteredEvents)
        await event.payload.save()
          .then(() => {
            // Publish event if record successfully saved
            event.payload = _.omit(event.payload.toJSON(), ['controlIndexHash', '_id', '__v']);
            channel.publish('events', `${config.rabbit.serviceName}_chrono_sc.${event.name.toLowerCase()}`, new Buffer(JSON.stringify(event)));
          })
          .catch((e) => {
            log.error(e);
          });

      channel.ack(data);

    } catch (err) {
      log.error(err);
      if (err && err.code !== 11000) {
        await Promise.delay(1000);
        channel.nack(data);
      }
    }
  });
};

module.exports = init();

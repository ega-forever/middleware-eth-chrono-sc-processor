# middleware-eth-chrono-sc-processor [![Build Status](https://travis-ci.org/ChronoBank/middleware-eth-chrono-sc-processor.svg?branch=master)](https://travis-ci.org/ChronoBank/middleware-eth-chrono-sc-processor)

Middleware service for handling emitted events on chronobank platform

### Installation

This module is a part of middleware services. You can install it in 2 ways:

1) through core middleware installer  [middleware installer](https://github.com/ChronoBank/middleware)
2) by hands: just clone the repo, do 'npm install', set your .env - and you are ready to go

#### About
This module is used for processing events, emitted on chronobank smart contracts (see a description of accounts in [block processor](https://github.com/ChronoBank/middleware-eth-blockprocessor)).


#### How does it work

This how does it work:
1) this module register multiAddress (from which events are emitted on chonobank smart contracts) in database in EthAccounts collection
2) blockprocessor filter transactions by tx.to, tx.from and addresses in logs.
3) chronoSc processor catch a new tx through rabbitmq, and parse it
4) if he find smth inside logs, then chronoSc decode its definition and save to a propriate collection (called by event's name). For instance, we have an event called 'Tranfer'. When a new event is emitted, chronoSc processor catch it, and save to a collection 'transfers'. Also, chronoSc parser send notification via rabbitmq, with the routing key, named as event, but with lowercase - in our case 'transfer', and message - are the raw event's arguments, passed to event.



##### сonfigure your .env

To apply your configuration, create a .env file in root folder of repo (in case it's not present already).
Below is the expamle configuration:

```
MONGO_ACCOUNTS_URI=mongodb://localhost:27017/data
MONGO_ACCOUNTS_COLLECTION_PREFIX=eth

MONGO_DATA_URI=mongodb://localhost:27017/data
MONGO_DATA_COLLECTION_PREFIX=eth

RABBIT_URI=amqp://localhost:5672
SMART_CONTRACTS_EVENTS_TTL=0
RABBIT_SERVICE_NAME=app_eth
NETWORK=development
WEB3_URI=/tmp/development/geth.ipc
SMART_CONTRACTS_PATH=/user/app/node_modules/chronobank-smart-contracts/build/contracts
SMART_CONTRACTS_EVENT_CONTRACT=MultiEventsHistory
```

The options are presented below:

| name | description|
| ------ | ------ |
| MONGO_URI   | the URI string for mongo connection
| MONGO_COLLECTION_PREFIX   | the default prefix for all mongo collections. The default value is 'eth'
| MONGO_ACCOUNTS_URI   | the URI string for mongo connection, which holds users accounts (if not specified, then default MONGO_URI connection will be used)
| MONGO_ACCOUNTS_COLLECTION_PREFIX   | the collection prefix for accounts collection in mongo (If not specified, then the default MONGO_COLLECTION_PREFIX will be used)
| MONGO_DATA_URI   | the URI string for mongo connection, which holds data collections (for instance, processed block's height). In case, it's not specified, then default MONGO_URI connection will be used)
| MONGO_DATA_COLLECTION_PREFIX   | the collection prefix for data collections in mongo (If not specified, then the default MONGO_COLLECTION_PREFIX will be used)
| RABBIT_URI   | rabbitmq URI connection string
| SMART_CONTRACTS_EVENTS_TTL   | how long should we keep events in db (should be set in seconds)
| RABBIT_SERVICE_NAME   | namespace for all rabbitmq queues, like 'app_eth_transaction'
| NETWORK   | network name (alias)- is used for connecting via ipc (see block processor section)
| WEB3_URI   | the path to ipc interface
| SMART_CONTRACTS_PATH   | the path to built smart contracts (optional)
| SMART_CONTRACTS_EVENT_CONTRACT   | the smart contract, from which address events are emitted

License
----
 [GNU AGPLv3](LICENSE)

Copyright
----
LaborX PTY
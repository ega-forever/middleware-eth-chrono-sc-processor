# middleware-eth-chrono-sc-processor [![Build Status](https://travis-ci.org/ChronoBank/middleware-eth-chrono-sc-processor.svg?branch=master)](https://travis-ci.org/ChronoBank/middleware-eth-chrono-sc-processor)

Middleware service for handling emitted events on chronobank platform

### Installation

This module is a part of middleware services. You can install it in 2 ways:

1) through core middleware installer  [middleware installer](https://github.com/ChronoBank/middleware)
2) by hands: just clone the repo, do 'npm install', set your .env - and you are ready to go

#### About
This module is used for processing events, emitted on chronobank smart contracts.


#### How does it work

This how does it work:
1) this module register multiAddress (from which events are emitted on chonobank smart contracts) in database in EthAccounts collection
2) blockprocessor filter transactions by tx.to, tx.from and addresses in logs.
3) chronoSc processor catch a new tx through rabbitmq, and parse it
4) if he find smth inside logs, then chronoSc decode its definition and send the notification via rmq. For instance, we have an event called 'Tranfer'. When a new event is emitted, chronoSc processor catch it, parse and send notification via rabbitmq, with the routing key, named as event, but with lowercase - in our case 'transfer', and message, which contains the raw event's arguments (payload field), passed to event and event's name.
```
{
    name: 'Transfer',
    payload: {
        from: '0x7cfbe900247e5191d42416e348e912a988833ebf',
        to: '0xc69c2c879b39dfc53ca753491e2863264a0966b6',
        value: 10000000
    }
}
```


##### сonfigure your .env

To apply your configuration, create a .env file in root folder of repo (in case it's not present already).
Below is the expamle configuration:

```
MONGO_ACCOUNTS_URI=mongodb://localhost:27017/data
MONGO_ACCOUNTS_COLLECTION_PREFIX=eth

RABBIT_URI=amqp://localhost:5672
RABBIT_SERVICE_NAME=app_eth

SMART_CONTRACTS_NETWORK_ID=86
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
| RABBIT_URI   | rabbitmq URI connection string
| RABBIT_SERVICE_NAME   | namespace for all rabbitmq queues, like 'app_eth_transaction'
| SMART_CONTRACTS_PATH   | the path to built smart contracts (optional)
| SMART_CONTRACTS_EVENT_CONTRACT   | the smart contract, from which address events are emitted
| SMART_CONTRACTS_NETWORK_ID   | the network id (1-mainnet, 4-rinkeby and so on)
| LOG_LEVEL   | the logging level. Can be 'error' (which prints only errors) or 'info' (prints errors + info logs). Default is 'info' level

License
----
 [GNU AGPLv3](LICENSE)

Copyright
----
LaborX PTY
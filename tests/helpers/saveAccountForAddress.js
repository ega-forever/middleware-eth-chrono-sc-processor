const accountModel = require('../../models/accountModel');
module.exports = async (account) => {
    return await accountModel.update({address: account}, {$set: {address: account}}, {
        upsert: true,
        setDefaultsOnInsert: true
      });
};